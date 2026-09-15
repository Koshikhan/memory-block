CREATE SEQUENCE "public"."memory_order_number_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1 NO CYCLE;

CREATE SEQUENCE "public"."qr_batch_number_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE TABLE "public"."memories" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "public_code"       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "sender_name"       text                     NOT NULL,
  "recipient_name"    text                     NOT NULL,
  "message"           text                     NOT NULL DEFAULT ''::text,
  "audio_path"        text,
  "is_active"         boolean                  NOT NULL DEFAULT true,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "order_number"      text                     DEFAULT ('MB-'::text || lpad((nextval('public.memory_order_number_seq'::regclass))::text, 4, '0'::text)),
  "customer_name"     text,
  "customer_email"    text,
  "customer_phone"    text,
  "upload_token"      uuid,
  "upload_expires_at" timestamp with time zone,
  "status"            text                     NOT NULL DEFAULT 'READY'::text,
  "uploaded_at"       timestamp with time zone,
  "upload_pin"        text,
  "upload_source"     text                     DEFAULT 'STAFF'::text,
  "label_printed_at"  timestamp with time zone,
  CONSTRAINT "memories_audio_path_key" UNIQUE (audio_path),
  CONSTRAINT "memories_message_check" CHECK ((char_length(message) <= 500)),
  CONSTRAINT "memories_pkey" PRIMARY KEY (id),
  CONSTRAINT "memories_public_code_key" UNIQUE (public_code),
  CONSTRAINT "memories_recipient_name_check" CHECK (((char_length(recipient_name) >= 1) AND (char_length(recipient_name) <= 80))),
  CONSTRAINT "memories_sender_name_check" CHECK (((char_length(sender_name) >= 1) AND (char_length(sender_name) <= 80))),
  CONSTRAINT "memories_status_check" CHECK ((status = ANY (ARRAY['WAITING_FOR_UPLOAD'::text, 'READY'::text, 'CANCELLED'::text, 'ARCHIVED'::text]))),
  CONSTRAINT "memories_upload_source_check" CHECK ((upload_source = ANY (ARRAY['STAFF'::text, 'PRIVATE_LINK'::text, 'SHOP_QR'::text, 'PREMADE_QR'::text]))),
  "created_by"        uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "audio_belongs_to_creator" CHECK ((split_part(audio_path, '/'::text, 1) = (created_by)::text))
);

ALTER TABLE "public"."memories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."qr_batches" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "batch_number"       bigint                   NOT NULL DEFAULT nextval('public.qr_batch_number_seq'::regclass),
  "created_by"         uuid                     NOT NULL,
  "requested_quantity" integer                  NOT NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "qr_batches_pkey" PRIMARY KEY (id),
  CONSTRAINT "qr_batches_requested_quantity_check" CHECK (((requested_quantity >= 1) AND (requested_quantity <= 500)))
);

ALTER TABLE "public"."qr_batches"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."qr_codes" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "batch_id"     uuid                     NOT NULL,
  "code"         text                     NOT NULL,
  "created_by"   uuid                     NOT NULL,
  "status"       text                     NOT NULL DEFAULT 'AVAILABLE'::text,
  "memory_id"    uuid,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "assigned_at"  timestamp with time zone,
  "activated_at" timestamp with time zone,
  "voided_at"    timestamp with time zone,
  CONSTRAINT "qr_codes_pkey" PRIMARY KEY (id),
  CONSTRAINT "qr_codes_state_check"
    CHECK ((((status = 'AVAILABLE'::text) AND (memory_id IS NULL) AND (assigned_at IS NULL) AND (activated_at IS NULL)) OR ((status = 'ASSIGNED'::text) AND (memory_id IS
    NOT NULL) AND (assigned_at IS NOT NULL) AND (activated_at IS NULL)) OR ((status = 'ACTIVE'::text) AND (memory_id IS NOT NULL) AND (assigned_at IS NOT NULL) AND (activated_at IS
    NOT NULL)) OR (status = 'VOID'::text))),
  CONSTRAINT "qr_codes_status_check" CHECK ((status = ANY (ARRAY['AVAILABLE'::text, 'ASSIGNED'::text, 'ACTIVE'::text, 'VOID'::text])))
);

ALTER TABLE "public"."qr_codes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."staff_members" (
  "user_id"    uuid                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "staff_members_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."staff_members"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."qr_codes"
  ADD CONSTRAINT "qr_codes_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES public.qr_batches(id) ON DELETE CASCADE;

ALTER TABLE "public"."qr_codes"
  ADD CONSTRAINT "qr_codes_memory_id_fkey" FOREIGN KEY (memory_id) REFERENCES public.memories(id) ON DELETE SET NULL;

ALTER TABLE "public"."staff_members"
  ADD CONSTRAINT "staff_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

CREATE INDEX memories_label_printed_at_idx ON public.memories USING btree (label_printed_at);

CREATE INDEX memories_order_number_idx ON public.memories USING btree (order_number);

CREATE INDEX memories_upload_pin_idx ON public.memories USING btree (upload_pin)
  WHERE (upload_pin IS NOT NULL);

CREATE INDEX memories_upload_source_idx ON public.memories USING btree (upload_source);

CREATE UNIQUE INDEX memories_upload_token_unique ON public.memories USING btree (upload_token)
  WHERE (upload_token IS NOT NULL);

CREATE UNIQUE INDEX qr_batches_batch_number_unique ON public.qr_batches USING btree (batch_number);

CREATE INDEX qr_batches_created_at_idx ON public.qr_batches USING btree (created_at DESC);

CREATE INDEX qr_batches_created_by_idx ON public.qr_batches USING btree (created_by);

CREATE INDEX qr_codes_batch_id_idx ON public.qr_codes USING btree (batch_id);

CREATE UNIQUE INDEX qr_codes_code_unique ON public.qr_codes USING btree (code);

CREATE INDEX qr_codes_created_by_idx ON public.qr_codes USING btree (created_by);

CREATE UNIQUE INDEX qr_codes_live_memory_unique ON public.qr_codes USING btree (memory_id)
  WHERE ((memory_id IS NOT NULL) AND (status = ANY (ARRAY['ASSIGNED'::text, 'ACTIVE'::text])));

CREATE INDEX qr_codes_memory_id_idx ON public.qr_codes USING btree (memory_id);

CREATE INDEX qr_codes_status_idx ON public.qr_codes USING btree (status);

CREATE POLICY "Staff can view own QR batches" ON "public"."qr_batches"
  FOR SELECT
  TO "authenticated"
  USING ((created_by = auth.uid()));

CREATE POLICY "Staff can view own QR codes" ON "public"."qr_codes"
  FOR SELECT
  TO "authenticated"
  USING ((created_by = auth.uid()));

CREATE POLICY "Staff can read their own membership" ON "public"."staff_members"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Approved staff delete their own voice notes" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'voice-notes'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM public.staff_members
  WHERE (staff_members.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Approved staff read their own voice notes" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'voice-notes'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM public.staff_members
  WHERE (staff_members.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Approved staff upload their own voice notes" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'voice-notes'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM public.staff_members
  WHERE (staff_members.user_id = ( SELECT auth.uid() AS uid))))));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."memories";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."memory_order_number_seq" TO "anon", "authenticated", "postgres", "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."qr_batch_number_seq" TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."memories" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."memories" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."memories" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."qr_batches" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."qr_codes" TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."staff_members" FROM "authenticated";

GRANT SELECT ON TABLE "public"."staff_members" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."staff_members" TO "postgres", "service_role";

ALTER TABLE "public"."memories"
  ADD CONSTRAINT "memories_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.staff_members(user_id);

CREATE POLICY "Approved staff manage their own memories" ON "public"."memories"
  FOR ALL
  TO "authenticated"
  USING (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.staff_members
  WHERE (staff_members.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.staff_members
  WHERE (staff_members.user_id = ( SELECT auth.uid() AS uid))))));

