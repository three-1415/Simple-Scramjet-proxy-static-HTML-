/************************
 * lil proxy worker
 * road.js edition
 ***********************/

// weird fix for firefox bein picky abt COOP/COEP
if (navigator.userAgent.includes("Firefox")) {
	Object.defineProperty(globalThis, "crossOriginIsolated", {
		value: true,
		writable: false,
	});
}

// pull in scramjet core (service worker helper) #FUCK SCERAM ONG
importScripts("/media/archive/Ultraviolet-Static.zip/Simple-Scramjet-proxy-static-HTML--main/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// fetch handler
async function handleRequest(event) {
	try {
		await scramjet.loadConfig();

		// route reqs thru scramjet if match
		if (scramjet.route(event)) {
			const response = await scramjet.fetch(event);
			const contentType = response.headers.get("content-type") || "";

			// if HTML → inject lil marker comment
			if (contentType.includes("text/html")) {
				const originalText = await response.text();
				const modifiedHtml = originalText.replace(
					/<head[^>]*>/i,
					(match) => `${match}<!-- proxied by road.js worker -->`
				);

				const newHeaders = new Headers(response.headers);
				// length fix (not super necessary but safer)
				newHeaders.set("content-length", modifiedHtml.length.toString());

				return new Response(modifiedHtml, {
					status: response.status,
					statusText: response.statusText,
					headers: newHeaders,
				});
			}

			return response;
		}

		// fallback to vanilla fetch
		return fetch(event.request);
	} catch (err) {
		console.error("worker broke:", err);
		return new Response("worker error", { status: 500 });
	}
}

// hook into fetch
self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

// lil "playground" memory thingy
let playgroundData;
self.addEventListener("message", ({ data }) => {
	if (data.type === "playgroundData") {
		playgroundData = data;
	}
});

// scramjet request hook for injecting test playground data
scramjet.addEventListener("request", (e) => {
	if (playgroundData && e.url.href.startsWith(playgroundData.origin)) {
		const headers = {};
		const origin = playgroundData.origin;

		if (e.url.href === origin + "/") {
			headers["content-type"] = "text/html";
			e.response = new Response(playgroundData.html, { headers });
		} else if (e.url.href === origin + "/media/archive/Ultraviolet-Static.zip/Simple-Scramjet-proxy-static-HTML--main/style.css") {
			headers["content-type"] = "text/css";
			e.response = new Response(playgroundData.css, { headers });
		} else if (e.url.href === origin + "/media/archive/Ultraviolet-Static.zip/Simple-Scramjet-proxy-static-HTML--main/script.js") {
			headers["content-type"] = "application/javascript";
			e.response = new Response(playgroundData.js, { headers });
		} else {
			e.response = new Response("/* empty resp */", { headers });
		}

		// raw info (scramjet expects this junk)
		e.response.rawHeaders = headers;
		e.response.rawResponse = {
			body: e.response.body,
			headers,
			status: e.response.status,
			statusText: e.response.statusText,
		};
		e.response.finalURL = e.url.toString();
	}
});
