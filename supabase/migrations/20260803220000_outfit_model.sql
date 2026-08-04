-- Point outfit generation at DeepSeek V4 Flash, chosen by measurement.
--
-- GLM-5.2 was the previous pick and is wrong for this workload in a way that
-- only showed up under load. It is a reasoning model with thinking on by
-- default: a live call spent all 3072 tokens on reasoning_tokens, returned
-- content: null with finish_reason "length", and still billed $0.0116. A
-- generation that produces nothing at 25x the budgeted cost is the same trap
-- that made the original Anthropic plan uneconomic — thinking billed as output.
--
-- Benchmarked on the multi-event case (client dinner at 4/5, drinks at 2/5),
-- which is the feature this workload exists to serve:
--
--   model                        latency   cost      swapNote  verdict
--   google/gemini-2.5-flash-lite   1.2s   $0.00015     0/3     fastest, never emits swapNote
--   qwen3-30b-a3b-instruct        12.3s   $0.00013     2/3     copied a prompt example verbatim
--   deepseek-v4-flash-0731        15-20s  $0.00070     3/3     correct on two consecutive runs
--   openai/gpt-oss-120b           45.4s   $0.00022     3/3     too slow
--
-- Reasoning is left ON deliberately. Disabling it cuts the call to 6s and
-- $0.00018, but quality drops measurably: swapNote coverage falls to 2/3 and
-- one run suggested borrowing a jacket from a different candidate — exactly the
-- cross-contamination the prompt forbids. The latency is affordable because the
-- on-device engine renders real outfits immediately and this only fills in the
-- names and reasoning afterwards.
--
-- At 60 generations a month that is about $0.04 per active user.

update ai_config
   set model_id   = 'deepseek/deepseek-v4-flash-0731',
       params     = '{"temperature": 0.7}'::jsonb,
       max_tokens = 3072,
       updated_at = now()
 where workload = 'outfit_generation';

-- Stylist chat is conversational and multi-turn, where thinking earns its cost:
-- it has to reason about the closet, the day, and what the user just said. Left
-- on GLM-5.2, but with the token ceiling raised so a thinking budget cannot
-- consume the entire allowance and return an empty message the way it did at
-- 3072 above.
update ai_config
   set max_tokens = 8192,
       updated_at = now()
 where workload = 'stylist_chat';
