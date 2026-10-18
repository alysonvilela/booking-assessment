The problem

When a guest completes a booking, we generate a confirmation code and must deliver it reliably to the
guest.

Our conditions
POST /bookings receives a booking (for example a reservationId and guest contact). It:
Generates a random 5-character confirmation code (letters and numbers), unique per booking.
Associates the code with the booking and persists it. Do not use a database — but treat
read/write operations as asynchronous.
The confirmation is then delivered to the guest out-of-band — not through the POST response. The
guest receives it over a channel you choose and simulate (e.g. a webhook / push / email stub), and the
guest's device sends back an acknowledgement that it arrived. The guest may not acknowledge
(phone offline, unstable connection, temporary loss), and if so the server must keep trying until the
confirmation is delivered.
GET /:code returns a JSON object with the booking details for that confirmation code.

A confirmation code is 5-character alphanumeric and unique — no two bookings share one.
The confirmation must eventually reach the guest even if their device is offline or unreachable when
you try to deliver — you cannot assume a live connection is open, so keep the confirmation and keep
trying until it gets through and is acknowledged.
A guest should never receive the same confirmation twice.
No database — in-memory or a file is fine, but read/write are asynchronous.

P E N T I C E pentice.com

Example

What we expect
System: POST http://localhost:3000/bookings → {"reservationId": "R123",
"guest": "ana@example.com"}
Server generates code a2b34, persists a2b34 → R123
Server delivers to the guest (not via the POST response): {"confirmationCode":
"a2b34", "reservationId": "R123"}
Guest device: acknowledges receipt
Later: GET http://localhost:3000/a2b34 → {"reservationId": "R123", ...}

POST generates a unique code and persists it, and GET resolves the code to the booking.
The confirmation is delivered to the guest out-of-band (not in the POST response), acknowledged, and
re-delivered if the guest doesn't ack.
You can explain and defend every decision you made (we'll walk through it together afterward).
Extras are a plus. If you finish the core in under 4 hours, anything nice-to-have you add, an extra
feature or a non-functional requirement, earns extra points. The more good extras, the better for you.

P E N T I C E pentice.com

Notes

Treat this like a feature you own in a sprint and present to the team. Show us what you'd get done in a
focused day with the information we gave you.
4 hours is the maximum, and integrity is mandatory. Keep to the time-box and be honest about the
time you spent. We do not expect a perfect app.
Prioritize and manage your time the way you do in your day-to-day work. We evaluate what you
deliver in that window as a real measure of your quality and velocity.
You choose the delivery channel and simulate the guest, and you can define the assumptions yourself,
just tell us what you decided.
Do not use a database — in-memory or a file is fine, but treat read/write as asynchronous.
We expect you to use AI (we build with AI every day). Use it heavily, but you own the result — the
code is yours to stand behind.
Questions are welcome, ask us anytime during your window.
A UI is optional here, the delivery and persistence logic matters more than any screen.
We should be able to understand what you built and why, easily.