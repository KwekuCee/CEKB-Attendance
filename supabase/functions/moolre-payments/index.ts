// Moolre Monthly Subscription Payments Edge Function
// Handles payment initiation, OTP verification, status polling, and Moolre webhooks.

import { corsHeaders as baseCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { getPortalSession } from '../_shared/portal-session.ts';
import { rateLimit } from '../_shared/rate-limit.ts';
import { sendMail } from '../_shared/mailer.ts';
import {
  DEFAULT_BILLING_SETTINGS,
  maskPhoneNumber,
  validateGhanaPhone,
  normalizeNetworkChannel,
  validateWebhookAmount,
  BillingSettings,
} from '../_shared/billing.ts';

const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-portal-session',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getBillingSettings(): Promise<BillingSettings> {
  const { data } = await admin
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'billing')
    .maybeSingle();

  if (data?.setting_value && typeof data.setting_value === 'object') {
    return { ...DEFAULT_BILLING_SETTINGS, ...data.setting_value };
  }
  return DEFAULT_BILLING_SETTINGS;
}

const InitiateSchema = z.object({
  churchName: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  phone: z.string().min(9),
  network: z.string().min(2),
});

const VerifyOtpSchema = z.object({
  externalRef: z.string().min(1),
  otpCode: z.string().min(3),
  sessionId: z.string().optional(),
});

const StatusSchema = z.object({
  externalRef: z.string().min(1),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');

  try {
    // ---------------------------------------------------------------- Webhook
    if (path.endsWith('/webhook')) {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'Invalid payload' }, 400);

      // Moolre may send data at root or wrapped in a data object
      const data = body.data || body;
      const externalRef = String(data.externalref || data.external_ref || body.externalref || '').trim();
      const txstatus = Number(data.txstatus ?? data.status);
      const receivedAmount = data.amount ?? body.amount;

      if (!externalRef) {
        return json({ error: 'Missing external reference' }, 400);
      }

      const { data: tx, error: txErr } = await admin
        .from('payment_transactions')
        .select('*')
        .eq('external_ref', externalRef)
        .maybeSingle();

      if (txErr || !tx) {
        return json({ error: 'Transaction not found' }, 404);
      }

      // Idempotency: if already paid, return ok
      if (tx.status === 'paid') {
        return json({ success: true, message: 'Already processed' });
      }

      // Verify amount matches expected subscription fee
      if (!validateWebhookAmount(tx.amount, receivedAmount)) {
        console.error(`[Moolre Webhook] Amount mismatch for ${externalRef}: expected ${tx.amount}, got ${receivedAmount}`);
        await admin.from('audit_logs').insert({
          actor: 'Moolre Webhook',
          action: `Payment rejected: amount mismatch for ${tx.church_name} (${externalRef}). Expected GH₵ ${tx.amount}, received GH₵ ${receivedAmount}`,
          category: 'Finance',
          icon: 'warning',
        });
        return json({ error: 'Amount mismatch' }, 400);
      }

      // txstatus: 1 = success, 2 = failed
      if (txstatus === 1) {
        const now = new Date().toISOString();
        await admin
          .from('payment_transactions')
          .update({
            status: 'paid',
            raw_response: body,
            updated_at: now,
          })
          .eq('id', tx.id);

        await admin.from('church_subscriptions').upsert(
          {
            church_name: tx.church_name,
            church_id: tx.church_id,
            period: tx.period,
            amount: tx.amount,
            status: 'paid',
            paid_at: now,
            payment_reference: externalRef,
            updated_at: now,
          },
          { onConflict: 'church_name,period' }
        );

        await admin.from('audit_logs').insert({
          actor: 'Moolre',
          action: `Subscription paid for ${tx.church_name} (${tx.period}) via Mobile Money (GH₵ ${tx.amount})`,
          category: 'Finance',
          icon: 'payments',
        });

        // Send confirmation receipt email if email is present
        if (tx.payer_email) {
          sendMail({
            to: tx.payer_email,
            subject: `Payment Receipt: CEKB Subscription for ${tx.church_name} (${tx.period})`,
            html: `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #000f22;">Payment Receipt — CEKB Group</h2>
              <p>Thank you. Your church subscription payment has been received and confirmed.</p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Church:</strong> ${tx.church_name}</p>
                <p style="margin: 4px 0;"><strong>Period:</strong> ${tx.period}</p>
                <p style="margin: 4px 0;"><strong>Amount Paid:</strong> GH₵ ${Number(tx.amount).toFixed(2)}</p>
                <p style="margin: 4px 0;"><strong>Channel:</strong> ${tx.channel} (${tx.masked_phone})</p>
                <p style="margin: 4px 0;"><strong>Reference:</strong> ${externalRef}</p>
                <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p style="color: #64748b; font-size: 13px;">Your pastor and administrator portal access is active for this period.</p>
            </div>`,
          }).catch((err) => console.error('Failed to send payment receipt email:', err));
        }

        return json({ success: true, status: 'paid' });
      } else if (txstatus === 2) {
        await admin
          .from('payment_transactions')
          .update({
            status: 'failed',
            raw_response: body,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tx.id);

        return json({ success: true, status: 'failed' });
      }

      return json({ success: true, status: 'pending' });
    }

    // ------------------------------------------------ Signed-in Actions
    const session = await getPortalSession(req);
    if (!session) {
      return json({ error: { message: 'Authentication required.' } }, 401);
    }

    const isPastorOrAdmin = session.role === 'Church Pastor' || session.role === 'Church Admin' || session.role === 'Developer';
    if (!isPastorOrAdmin) {
      return json({ error: { message: 'Only church pastors and administrators can manage billing.' } }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();

    // ------------------------------------------------ 1. Initiate Payment
    if (action === 'initiate' || path.endsWith('/initiate')) {
      const limited = await rateLimit(req, 'moolre-initiate', 6, 300, corsHeaders, session.user_email || session.role, true, true);
      if (limited) return limited;

      const parsed = InitiateSchema.safeParse(body);
      if (!parsed.success) {
        return json({ error: { message: parsed.error.errors[0]?.message || 'Invalid input.' } }, 400);
      }

      const { churchName, period, phone, network } = parsed.data;

      // Verify caller belongs to this church (or is developer)
      if (session.role !== 'Developer' && session.church_name && session.church_name.toLowerCase() !== churchName.toLowerCase()) {
        return json({ error: { message: 'You can only initiate payments for your own church branch.' } }, 403);
      }

      const phoneValidation = validateGhanaPhone(phone);
      if (!phoneValidation.valid) {
        return json({ error: { message: phoneValidation.error || 'Invalid phone number.' } }, 400);
      }

      const billingSettings = await getBillingSettings();
      if (!billingSettings.enabled && session.role !== 'Developer') {
        return json({ error: { message: 'Monthly subscription payments are currently disabled.' } }, 400);
      }

      const amount = billingSettings.monthlyFee;
      const { channelCode, channelName } = normalizeNetworkChannel(network);
      const maskedPhone = maskPhoneNumber(phoneValidation.formatted);
      const externalRef = `CEKB-${period}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create pending transaction in database
      const { error: insErr } = await admin.from('payment_transactions').insert({
        church_name: churchName,
        church_id: session.church_id || null,
        period,
        amount,
        external_ref: externalRef,
        channel: channelName,
        masked_phone: maskedPhone,
        status: 'pending',
        payer_email: session.user_email || null,
      });

      if (insErr) {
        console.error('Failed to create payment transaction record:', insErr);
        return json({ error: { message: 'Could not prepare payment record.' } }, 500);
      }

      const apiKey = Deno.env.get('MOOLRE_API_KEY')?.trim();
      const apiUser = Deno.env.get('MOOLRE_API_USER')?.trim();
      const accountNumber = Deno.env.get('MOOLRE_ACCOUNT_NUMBER')?.trim();

      // If test mode or credentials are not configured, simulate sandbox workflow
      if (billingSettings.testMode || !apiKey || !apiUser) {
        const needsOtp = channelName === 'Telecel';
        return json({
          success: true,
          externalRef,
          amount,
          period,
          churchName,
          maskedPhone,
          channel: channelName,
          testMode: true,
          needsOtp,
          sessionId: needsOtp ? `sim-${externalRef}` : undefined,
          promptSent: !needsOtp,
          message: needsOtp
            ? 'Telecel Cash requires a verification token. Please enter your approval token.'
            : `Approval prompt sent to ${maskedPhone}. Please authorize GH₵ ${amount} on your phone.`,
        });
      }

      // Live Moolre API Request
      try {
        const moolreRes = await fetch('https://api.moolre.com/open/transact/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-USER': apiUser,
            'X-API-KEY': apiKey,
          },
          body: JSON.stringify({
            accountnumber: accountNumber,
            channel: parseInt(channelCode, 10),
            currency: 'GHS',
            payer: phoneValidation.formatted,
            amount: amount,
            externalref: externalRef,
            reference: `CEKB Subscription - ${churchName} (${period})`,
          }),
        });

        const moolreData = await moolreRes.json().catch(() => null);

        // Update raw response
        await admin
          .from('payment_transactions')
          .update({ raw_response: moolreData, moolre_reference: moolreData?.data?.transactionid || null })
          .eq('external_ref', externalRef);

        const needsOtp = Boolean(moolreData?.data?.needs_otp || channelName === 'Telecel');

        return json({
          success: true,
          externalRef,
          amount,
          period,
          churchName,
          maskedPhone,
          channel: channelName,
          testMode: false,
          needsOtp,
          sessionId: moolreData?.data?.sessionid || undefined,
          promptSent: !needsOtp,
          message: needsOtp
            ? 'Please enter the authorization OTP sent to your phone.'
            : `Approval prompt sent to ${maskedPhone}. Please authorize GH₵ ${amount} on your phone.`,
        });
      } catch (err: any) {
        console.error('Moolre payment request failed:', err);
        return json({ error: { message: 'Could not contact payment provider. Please try again.' } }, 502);
      }
    }

    // ------------------------------------------------ 2. Verify OTP
    if (action === 'verify-otp' || path.endsWith('/verify-otp')) {
      const limited = await rateLimit(req, 'moolre-otp', 8, 300, corsHeaders, session.user_email || session.role, true, true);
      if (limited) return limited;

      const parsed = VerifyOtpSchema.safeParse(body);
      if (!parsed.success) {
        return json({ error: { message: 'Invalid OTP submission.' } }, 400);
      }

      const { externalRef, otpCode, sessionId } = parsed.data;
      const { data: tx } = await admin
        .from('payment_transactions')
        .select('*')
        .eq('external_ref', externalRef)
        .maybeSingle();

      if (!tx) return json({ error: { message: 'Transaction not found.' } }, 404);

      const billingSettings = await getBillingSettings();
      const apiKey = Deno.env.get('MOOLRE_API_KEY')?.trim();
      const apiUser = Deno.env.get('MOOLRE_API_USER')?.trim();

      if (billingSettings.testMode || !apiKey || !apiUser) {
        // In test mode, accept any 4-6 digit OTP
        if (otpCode.length < 4) {
          return json({ error: { message: 'Please enter a valid OTP code.' } }, 400);
        }

        const now = new Date().toISOString();
        await admin.from('payment_transactions').update({ status: 'paid', updated_at: now }).eq('id', tx.id);
        await admin.from('church_subscriptions').upsert(
          {
            church_name: tx.church_name,
            church_id: tx.church_id,
            period: tx.period,
            amount: tx.amount,
            status: 'paid',
            paid_at: now,
            payment_reference: externalRef,
            updated_at: now,
          },
          { onConflict: 'church_name,period' }
        );

        await admin.from('audit_logs').insert({
          actor: session.user_name || session.user_email || 'Church Admin',
          action: `Subscription paid for ${tx.church_name} (${tx.period}) via Mobile Money OTP (GH₵ ${tx.amount})`,
          category: 'Finance',
          icon: 'payments',
        });

        return json({ success: true, status: 'paid', message: 'OTP verified. Payment confirmed!' });
      }

      // Forward OTP to Moolre
      try {
        const mRes = await fetch('https://api.moolre.com/open/transact/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-USER': apiUser,
            'X-API-KEY': apiKey,
          },
          body: JSON.stringify({
            externalref: externalRef,
            otpcode: otpCode,
            sessionid: sessionId || tx.session_id,
          }),
        });
        const mData = await mRes.json().catch(() => null);

        if (mData?.status === 1 || mData?.data?.txstatus === 1) {
          const now = new Date().toISOString();
          await admin.from('payment_transactions').update({ status: 'paid', raw_response: mData, updated_at: now }).eq('id', tx.id);
          await admin.from('church_subscriptions').upsert(
            {
              church_name: tx.church_name,
              church_id: tx.church_id,
              period: tx.period,
              amount: tx.amount,
              status: 'paid',
              paid_at: now,
              payment_reference: externalRef,
              updated_at: now,
            },
            { onConflict: 'church_name,period' }
          );

          return json({ success: true, status: 'paid' });
        }

        return json({ success: false, error: { message: mData?.message || 'OTP verification failed. Please try again.' } });
      } catch (err: any) {
        return json({ error: { message: 'Could not contact payment provider.' } }, 502);
      }
    }

    // ------------------------------------------------ 3. Status Polling
    if (action === 'status' || path.endsWith('/status')) {
      const parsed = StatusSchema.safeParse(body);
      if (!parsed.success) return json({ error: { message: 'Invalid reference.' } }, 400);

      const { externalRef } = parsed.data;
      const { data: tx } = await admin
        .from('payment_transactions')
        .select('*')
        .eq('external_ref', externalRef)
        .maybeSingle();

      if (!tx) return json({ error: { message: 'Transaction not found.' } }, 404);

      if (tx.status === 'paid') {
        return json({ success: true, status: 'paid', period: tx.period, churchName: tx.church_name });
      }

      const billingSettings = await getBillingSettings();
      const apiKey = Deno.env.get('MOOLRE_API_KEY')?.trim();
      const apiUser = Deno.env.get('MOOLRE_API_USER')?.trim();

      // If test mode and pending for > 3 seconds, mark as paid automatically
      if (billingSettings.testMode || !apiKey || !apiUser) {
        const createdMs = new Date(tx.created_at).getTime();
        if (Date.now() - createdMs > 3000) {
          const now = new Date().toISOString();
          await admin.from('payment_transactions').update({ status: 'paid', updated_at: now }).eq('id', tx.id);
          await admin.from('church_subscriptions').upsert(
            {
              church_name: tx.church_name,
              church_id: tx.church_id,
              period: tx.period,
              amount: tx.amount,
              status: 'paid',
              paid_at: now,
              payment_reference: externalRef,
              updated_at: now,
            },
            { onConflict: 'church_name,period' }
          );

          await admin.from('audit_logs').insert({
            actor: session.user_name || session.user_email || 'Church Admin',
            action: `Subscription paid for ${tx.church_name} (${tx.period}) via Mobile Money prompt (GH₵ ${tx.amount})`,
            category: 'Finance',
            icon: 'payments',
          });

          return json({ success: true, status: 'paid', period: tx.period, churchName: tx.church_name });
        }
        return json({ success: true, status: 'pending' });
      }

      // Check Moolre status API
      try {
        const sRes = await fetch('https://api.moolre.com/open/transact/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-USER': apiUser,
            'X-API-KEY': apiKey,
          },
          body: JSON.stringify({ externalref: externalRef }),
        });
        const sData = await sRes.json().catch(() => null);
        const txStatus = Number(sData?.data?.txstatus ?? sData?.status);

        if (txStatus === 1) {
          const now = new Date().toISOString();
          await admin.from('payment_transactions').update({ status: 'paid', raw_response: sData, updated_at: now }).eq('id', tx.id);
          await admin.from('church_subscriptions').upsert(
            {
              church_name: tx.church_name,
              church_id: tx.church_id,
              period: tx.period,
              amount: tx.amount,
              status: 'paid',
              paid_at: now,
              payment_reference: externalRef,
              updated_at: now,
            },
            { onConflict: 'church_name,period' }
          );

          return json({ success: true, status: 'paid', period: tx.period, churchName: tx.church_name });
        } else if (txStatus === 2) {
          await admin.from('payment_transactions').update({ status: 'failed', raw_response: sData, updated_at: new Date().toISOString() }).eq('id', tx.id);
          return json({ success: true, status: 'failed', error: 'Payment was declined or timed out.' });
        }

        return json({ success: true, status: 'pending' });
      } catch (err: any) {
        return json({ success: true, status: tx.status });
      }
    }

    return json({ error: { message: 'Unknown moolre-payments action.' } }, 400);
  } catch (err: any) {
    console.error('moolre-payments error:', err);
    return json({ error: { message: err?.message || 'Payment system error.' } }, 500);
  }
});
