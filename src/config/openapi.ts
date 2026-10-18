import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pentice API docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi/json",
        dom_id: "#swagger-ui",
      });
    </script>
  </body>
</html>`;

export const openapi = new Elysia({ name: "openapi" })
	.use(
		swagger({
			path: "/openapi",
			documentation: {
				info: {
					title: "Pentice API",
					version: "1.0.0",
					description:
						"Booking confirmation API: out-of-band delivery, retried until the guest acknowledges.",
				},
				tags: [{ name: "health" }, { name: "bookings" }, { name: "simulator" }],
			},
		}),
	)
	.get(
		"/openapi",
		() =>
			new Response(HTML, {
				headers: { "content-type": "text/html; charset=utf-8" },
			}),
		{ detail: { hide: true } },
	);
