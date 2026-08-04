-- Model selection, verified against OpenRouter's live catalogue on 2026-08-03.
-- All three support strict `response_format` structured outputs and tool calling.
--
-- Cost per user, at 25-item onboarding + 60 generations/month:
--   tagging          ~$0.02 once   (1.7k in / 250 out per item)
--   outfit_generation ~$0.34/month (6.3k in / 800 out per generation)
--   ------------------------------------------------------------------
--   ~$0.36/user/month against $8.49 net revenue at $9.99 — ~96% margin.
--
-- Swapping any of these is an UPDATE against this table, not an App Store
-- release. That is the whole reason the table exists.

update ai_config
   set model_id   = 'qwen/qwen3-vl-235b-a22b-instruct',
       params     = '{"temperature": 0.2}'::jsonb,
       max_tokens = 1024,
       updated_at = now()
 where workload = 'tagging';

-- GLM-5.2 rather than 4.6: newer, 1M context (the closet serialization has room
-- to grow), and cheaper on output — which is where reasoning models spend.
update ai_config
   set model_id   = 'z-ai/glm-5.2',
       params     = '{"temperature": 0.7}'::jsonb,
       max_tokens = 3072,
       updated_at = now()
 where workload = 'outfit_generation';

update ai_config
   set model_id   = 'z-ai/glm-5.2',
       params     = '{"temperature": 0.8}'::jsonb,
       max_tokens = 2048,
       updated_at = now()
 where workload = 'stylist_chat';
