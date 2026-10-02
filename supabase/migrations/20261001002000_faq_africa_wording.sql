-- RaiseReady is for founders across Africa, not only Nigeria. Reword the
-- payment answer, unless a super admin has already edited it.
update public.faq_items
set answer = 'Payments are handled by Paystack. You can pay with a card issued in any country. RaiseReady never sees or stores your card details.',
    updated_at = now()
where slug = 'how-to-pay'
  and locale = 'en'
  and answer = 'Payments are handled by Paystack. You can pay with a Nigerian or foreign card. RaiseReady never sees or stores your card details.';
