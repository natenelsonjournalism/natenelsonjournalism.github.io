---
title: "Vatican's Official Prayer App Leaks 700K+ Global Users' PII"
outlet: Dark Reading
date: 2026-07-23
url: https://www.darkreading.com/vulnerabilities-threats/vatican-official-prayer-app-leaks-700k-pii
summary: "The Pope's official prayer app, Click to Pray, was exposing the names and email addresses of more than 700,000 users to anyone who asked. It was fixed after my story ran."
impact:
  - "The app's API was fixed after publication, protecting the personal information of more than 700,000 users"
  - "The flaw had gone unfixed for six months after a security researcher first reported it"
featured: true
---

Click to Pray is the official app of the Pope's Worldwide Prayer Network, with more
than 700,000 registered accounts around the world. In January, a security researcher
known as BobDaHacker found that one of its API endpoints would hand over any account's
personal details, including names, email addresses and countries, to anyone who asked.
No login was needed.

The researcher reported the flaw and heard nothing back for six months. I tested the
endpoint myself, confirmed the leak was real and still open, and asked the company that
built the app for comment before publishing.

Shortly after the story ran, the endpoint was changed. It now returns only public
profile names, and keeps users' email addresses and other personal details private.
