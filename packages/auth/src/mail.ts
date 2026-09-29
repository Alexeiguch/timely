import { Resend } from 'resend';
import nodemailer from 'nodemailer';
export async function sendCode(email: string, otp: string) {
  const message = { from: process.env.MAIL_FROM ?? 'Timely <signin@timely.local>', to: email, subject: 'Your Timely sign-in code', text: `Your Timely code is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.` };
  const localBuiltApp = process.env.APP_ENV === 'local' &&
    ['localhost', '127.0.0.1'].includes(new URL(process.env.BETTER_AUTH_URL ?? 'https://invalid').hostname) &&
    ['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL ?? 'https://invalid').hostname);
  if (process.env.MAIL_MODE === 'capture' && (process.env.NODE_ENV !== 'production' || localBuiltApp)) {
    // Local Mailpit only. Never print codes to application logs.
    await nodemailer.createTransport({ host: '127.0.0.1', port: Number(process.env.MAIL_CAPTURE_PORT ?? 1025), secure: false }).sendMail(message);
    return;
  }
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) throw new Error('Email delivery is not configured');
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(message);
  if (result.error) throw new Error('Email delivery unavailable');
}
