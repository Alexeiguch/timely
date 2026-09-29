import { Resend } from 'resend';
import nodemailer from 'nodemailer';
export async function sendCode(email: string, otp: string) {
  const message = { from: process.env.MAIL_FROM ?? 'Timely <signin@timely.local>', to: email, subject: 'Your Timely sign-in code', text: `Your Timely code is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.` };
  if (process.env.MAIL_MODE === 'capture' && process.env.NODE_ENV !== 'production') {
    // Local Mailpit only. Never print codes to application logs.
    await nodemailer.createTransport({ host: '127.0.0.1', port: Number(process.env.MAIL_CAPTURE_PORT ?? 1025), secure: false }).sendMail(message);
    return;
  }
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) throw new Error('Email delivery is not configured');
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(message);
  if (result.error) throw new Error('Email delivery unavailable');
}
