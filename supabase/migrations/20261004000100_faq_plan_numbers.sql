-- The Pro answer quotes its monthly practice sessions from Admin → Plans
-- ({pro.simulations} is filled in when the FAQ is shown), so it stays right
-- when the plan changes. Only the original wording is touched: an answer a
-- super admin has already rewritten is left alone. Safe to run more than once.
update public.faq_items
set answer = replace(answer, 'up to 30 practice sessions a month', 'up to {pro.simulations} practice sessions a month'),
    updated_at = now()
where slug = 'pro-plan'
  and answer like '%up to 30 practice sessions a month%';
