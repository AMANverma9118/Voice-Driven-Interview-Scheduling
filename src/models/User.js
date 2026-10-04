const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['admin', 'candidate'], default: 'candidate' },
    platform: { type: Boolean, default: false },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    revoked: { type: Boolean, default: false },
    verificationTokenHash: { type: String, default: null },
    verificationExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1, company: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
