self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch (error) {
    console.error("Could not read the push notification payload:", error);
  }

  const title = typeof message.title === "string" ? message.title : "Vanya BuildTrack";
  const icon = new URL("/buildtrack-icon.png?v=4", self.location.origin).href;
  const options = {
    body: typeof message.body === "string" ? message.body : "There is a new update in your workspace.",
    icon,
    badge: icon,
    data: { url: typeof message.url === "string" ? message.url : "/admin" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
