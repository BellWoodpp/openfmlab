ALTER TABLE "tts_generations" ADD COLUMN "audio_key" text;
ALTER TABLE "tts_generations" ADD COLUMN "audio_size" bigint;
ALTER TABLE "tts_generations" ALTER COLUMN "audio" DROP NOT NULL;

ALTER TABLE "voice_clone_samples" ADD COLUMN "audio_key" text;
ALTER TABLE "voice_clone_samples" ADD COLUMN "audio_size" bigint;
ALTER TABLE "voice_clone_samples" ALTER COLUMN "audio" DROP NOT NULL;

