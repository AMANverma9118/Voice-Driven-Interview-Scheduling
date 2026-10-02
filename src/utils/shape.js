function shapeJob(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    requirements: doc.requirements,
    department: doc.department || '',
    location: doc.location || '',
    status: doc.status,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

function shapeCandidate(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone,
    email: doc.email || '',
    current_ctc: doc.current_ctc,
    expected_ctc: doc.expected_ctc,
    notice_period: doc.notice_period,
    experience_years: doc.experience_years,
    status: doc.status,
    resume_name: doc.resume_name || '',
    has_resume: Boolean(doc.resume_name),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

function refId(value) {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
}

function shapeAppointment(doc) {
  if (!doc) return null;
  const job = doc.job && doc.job.title ? doc.job : null;
  const candidate = doc.candidate && doc.candidate.name ? doc.candidate : null;
  return {
    id: doc._id.toString(),
    job_id: refId(doc.job),
    candidate_id: refId(doc.candidate),
    job_title: job ? job.title : '',
    candidate_name: candidate ? candidate.name : '',
    date_time: doc.date_time,
    status: doc.status,
    calendar_event_id: doc.calendar_event_id || null,
    notes: doc.notes || '',
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

function shapeInterview(doc) {
  if (!doc) return null;
  const job = doc.job && doc.job.title ? doc.job : null;
  const candidate = doc.candidate && doc.candidate.name ? doc.candidate : null;
  return {
    id: doc._id.toString(),
    job_id: refId(doc.job),
    candidate_id: refId(doc.candidate),
    job_title: job ? job.title : '',
    candidate_name: candidate ? candidate.name : '',
    interested: doc.interested,
    notice_period: doc.notice_period,
    current_ctc: doc.current_ctc,
    expected_ctc: doc.expected_ctc,
    available_date: doc.available_date,
    confirmed: doc.confirmed,
    notes: doc.notes || '',
    source: doc.source,
    turns: (doc.turns || []).map((turn) => ({
      prompt: turn.prompt || '',
      answer: turn.answer || '',
      has_audio: Boolean(turn.recorded || (turn.audio && turn.audio.length)),
    })),
    appointment_id: doc.appointment ? refId(doc.appointment) : null,
    created_at: doc.createdAt,
  };
}

module.exports = {
  shapeJob,
  shapeCandidate,
  shapeAppointment,
  shapeInterview,
};
