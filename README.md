# Voice-Driven Interview Scheduler

A voice-driven application that automates interview scheduling by conducting conversational interviews with candidates, collecting key details, and booking appointments.

## Features

- Voice-based interview conduction
- Natural language processing for candidate responses
- Automated appointment scheduling
- Candidate information collection
- Integration with Google Calendar
- Admin dashboard for job and candidate management
- Real-time voice call capabilities (via Twilio)

## Tech Stack

- Backend: Node.js + Express
- Database: MySQL
- Voice Processing: Vosk (STT), Mozilla TTS
- NLP: node-nlp
- Calendar Integration: Google Calendar API
- Voice Calls: Twilio (optional)

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v8 or higher)
- Vosk speech recognition model
- Twilio account (for real voice calls)
- Google Calendar API credentials

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd interview-scheduler
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env`
- Update the variables with your credentials

4. Set up the database:
```bash
mysql -u root -p < src/config/schema.sql
```

5. Download Vosk model:
- Visit [Vosk Models](https://alphacephei.com/vosk/models)
- Download the appropriate model for your language
- Update the `VOSK_MODEL_PATH` in `.env`

## Usage

1. Start the server:
```bash
npm start
```

2. Access the API endpoints:
- Voice interview: POST `/api/voice/start-interview`
- Test voice: POST `/api/voice/test`
- Job management: GET/POST/PUT/DELETE `/api/jobs`
- Candidate management: GET/POST/PUT/DELETE `/api/candidates`
- Appointment management: GET/POST/PUT/DELETE `/api/appointments`

## API Documentation

### Voice Interview Endpoint

```http
POST /api/voice/start-interview
Content-Type: application/json

{
  "jobId": 1,
  "candidateId": 1
}
```

### Test Voice Endpoint

```http
POST /api/voice/test
Content-Type: application/json

{
  "text": "Hello, this is a test message"
}
```

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
├── middleware/      # Custom middleware
├── voice-agent/     # Voice processing logic
└── app.js           # Main application file
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Vosk for speech recognition
- Mozilla TTS for text-to-speech
- Twilio for voice call capabilities
- Google Calendar API for scheduling 