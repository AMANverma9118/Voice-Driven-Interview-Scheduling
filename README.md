# Interview Desk

Interview Desk is a voice-driven hiring desk. An admin opens roles and adds the people who will interview. A candidate signs in, fills in their own details, uploads a resume, and takes a spoken interview in the browser. The desk asks the questions in a natural voice, listens to the answers, and books a weekday and a time. The recording stays with the interview. If the admin moves that time, the candidate gets a bell notice.

## Who uses it

**Admin.** Runs the desk: roles, accounts, the month calendar, the call sheet, and messages.

**Candidate.** Signs in, saves a profile and a resume, takes the spoken interview, and reads notices about a changed time.

## Features

### Accounts

- Each person has their own account, with a signed token kept in the browser.
- Sign-up and sign-in use a Google reCAPTCHA v2 checkbox.
- New accounts confirm their email. If mail is not configured, the confirmation link is shown on the page.
- The first admin is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. The password is stored as a hash.
- An admin can add other admins from Team, and can revoke an account. A revoked person cannot sign in.

### Spoken interview

- The candidate picks an open role and a microphone. That microphone is used for every question.
- The desk speaks with a natural female voice, then listens through the browser microphone.
- It asks about interest, notice period, current pay, expected pay, and a day and time, for example “Monday at 3 pm”.
- It repeats the time it heard and waits for a yes before booking.
- Each answer is saved with a recording. The candidate can play them under Record. The admin can play them on the call sheet.

### Calendar

- Booked interviews appear on a month grid.
- The admin can move a time. The candidate then sees a bell, with a count, and the new time in Messages.
- The admin can also write to the candidate and suggest another time. The candidate can accept it.
- The admin does not book the original slot. The candidate does that during the interview.

### Profiles and resumes

- The candidate’s details stay locked until they press Edit.
- They can upload a PDF or Word resume, up to 4 MB.
- The admin sees those details and can open the resume from People. The admin does not type the experience or pay.

### Desk appearance

- Studio holds the desk name, the logo, and the colours candidates see.

## Run it

You need Node.js 20 or newer, and a MongoDB database. Atlas works. A local MongoDB works too.

```bash
npm install --ignore-scripts
npm install --prefix client
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env`.

Set these in `.env` before the first start:

- `DATABASE_URL` or `MONGODB_URI` — the MongoDB address. If the address has no database name, set `DB_NAME` (the default is `interview_scheduler`).
- `JWT_SECRET` — a long random string.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` — at least 8 characters. Restart after you change them.
- `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` — Google reCAPTCHA v2 checkbox keys. The values in `.env.example` are Google’s public test keys.
- `APP_URL` — `http://localhost:3000` while you are developing.

Then:

```bash
npm run build
npm start
```

Open `http://localhost:3000`.

Sign in with the admin email and password from `.env`. From Team, add a candidate with a name, email, and password. That person signs in, opens Details, presses Edit, and saves a phone number before the interview.

For frontend work while the API is already running:

```bash
npm run client
```

That opens the React app at `http://localhost:5173` and sends API calls to port 3000. After you change the interface that `npm start` serves, run `npm run build` again and refresh. Restart `npm start` when the server code changes.

### If Atlas will not connect

The desk can be running and still show “Database is not connected”. Atlas often refuses a computer whose address is not on the cluster allow list. In Atlas, open Network Access, add your current IP address, then start the server again. A paused cluster produces the same failure.

### Optional pieces

Leave these blank until you need them.

- **Email.** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`. Without them, verification links and time-change notices stay inside the app.
- **Google Calendar.** Set `GOOGLE_CALENDAR_ID` and `GOOGLE_CREDENTIALS`. A failed calendar sync still saves the interview on the desk.
- **Twilio.** Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` for outbound calls.
- **Server microphone.** `npm run setup-vosk` downloads the small English model. The interview candidates take in the browser uses that model on the server. `VOSK_MODEL_PATH` points at it.

`npm run setup-db` only makes sure the MongoDB indexes exist. Collections are created the first time they are used.

## Deploy

The API can run on Render. The site can run on Vercel. They are two separate projects that point at each other.

### Render (API)

Yes. This backend is a Node web service. It already reads `PORT`, which Render sets, and it starts with `npm start`.

In the Render dashboard, point the service at the repository root:

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Node version: 20

`npm install` on Render should run normally. The speech library compiles a small native piece (`ffi-napi`) during install. Render’s Linux image can do that. If the build log stops on `ffi-napi`, the API process can still start, but the spoken interview will not hear answers until that compile succeeds.

Set these environment variables on the Render service. Do not commit the real values.

- `DATABASE_URL` — the Atlas connection string
- `DB_NAME` — `interview_scheduler` if the connection string has no database name
- `JWT_SECRET`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY`
- `APP_URL` — the Vercel address, such as `https://your-desk.vercel.app`
- `CLIENT_ORIGIN` — the same Vercel address

Atlas must allow the machine that is calling it. Render’s outbound address changes, so in Atlas Network Access add `0.0.0.0/0`. A paused cluster fails the same way. After the service is up, open `https://your-service.onrender.com/api/health`. `ok: true` means MongoDB is connected. `database: disconnected` means Atlas refused the connection or the URI is wrong.

The small English speech model is already in `models/vosk-model-small-en-us-0.15`, so a deploy from this repository includes it. Candidates speak in the browser, and the server hears them with that model.

A free Render service sleeps after a quiet period. The first request after that takes longer.

### Vercel (site)

The React app lives in `client`. In the Vercel project:

- Root Directory: `client`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Set `VITE_API_URL` to the Render origin with no slash at the end, for example `https://your-service.onrender.com`. Vite bakes that value in at build time, so change it and deploy again if the Render address changes. Leave it empty in local development. The dev server still proxies `/api` to `http://localhost:3000`.

`client/vercel.json` sends every route to `index.html`, so a refresh on `/overview` or `/profile` stays in the app.

After both are live, sign in on the Vercel address. Register, open the interview, and confirm a booking shows on the Render-backed calendar.

## What is on each page

| Page | Who | What it is for |
| --- | --- | --- |
| Overview | Admin | Open roles, people on file, interviews in the next 7 days |
| Roles | Admin | Jobs the spoken interview can be about |
| Team | Admin | Create a candidate account, or make someone an admin |
| People | Admin | The profile and resume the candidate saved |
| Calendar | Admin | Month of booked times, with change, write, and remove |
| Call sheet | Admin | Answers and recordings from the spoken interview |
| Studio | Admin | Name, logo, and colours |
| Details | Candidate | Profile and resume |
| Interview | Candidate | The spoken call that books a time |
| Record | Candidate | What they said, and the audio |
| Messages | Candidate | Notes from the desk, including a moved time |

## API

The browser calls these. Admin routes require an admin token.

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify`, `POST /api/auth/resend`, `GET /api/auth/me`
- `GET /api/auth/config` — the reCAPTCHA site key
- `GET/PUT /api/me/profile`, `GET /api/me/resume`
- `POST /api/me/hear`, `POST /api/me/speak`
- `POST /api/interviews`, `GET /api/interviews/mine`
- `GET /api/me/messages`, `GET /api/me/notices`
- `GET/POST /api/jobs`, `GET/POST /api/candidates`, `GET/PUT/DELETE /api/appointments`
- `GET /api/health`
