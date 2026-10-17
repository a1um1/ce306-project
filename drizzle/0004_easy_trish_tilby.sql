CREATE TABLE "merchant_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"key" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_rule" ADD CONSTRAINT "merchant_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_rule" ADD CONSTRAINT "merchant_rule_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_rule_user_key_idx" ON "merchant_rule" USING btree ("user_id","key");--> statement-breakpoint
-- Seed merchant memory: keys are merchantCore(slip title) for merchants that
-- recur in the existing slips (migration-time snapshot). user_id IS NULL =
-- shared seed, overridden by the user's own rule for the same key.
INSERT INTO "merchant_rule" ("id", "user_id", "key", "category_id", "created_at", "updated_at") VALUES
  ('seed-01', NULL, 'truemoney', 'builtin-other', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- TRUE MONEY COMPANY LIMITED
  ('seed-02', NULL, 'grabpay', 'builtin-other', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- GrabPay Wallet
  ('seed-03', NULL, 'รานเวนดงบายบญเตมฟอรทสมารทเซอรวส', 'builtin-other', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- ร้านเวนดิ้งบายบุญเติม
  ('seed-04', NULL, 'shopeepay', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- SHOPEEPAY WALLET
  ('seed-05', NULL, 'themallgroupbr', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- THE MALL GROUP
  ('seed-06', NULL, 'cpaxtrahead', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- CP AXTRA
  ('seed-07', NULL, 'กรงศรมงมชอปโซหวย', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- กรุงศรี มั่งมี ช้อป (โซห่วย)
  ('seed-08', NULL, 'กรงศรมงมชอปโชหวย', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- กรุงศรีมั่งมีช้อป(โชห่วย)
  ('seed-09', NULL, 'กรงศรมงมชอปปากาญจน', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- กรุงศรี มั่งมี ช้อป (ป้ากาญจน์)
  ('seed-10', NULL, 'พระรามบกซซเปอรเซนเตอร', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- บิ๊กซี พระราม 2
  ('seed-11', NULL, 'พนธทพยงามวงศวานบกซซเปอรเซนเตอร', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- บิ๊กซี พันธุ์ทิพย์
  ('seed-12', NULL, 'บรษทชอปปเพยประเทศไทยจากดชอปปเพยประเทศไทย', 'builtin-shopping', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- ช้อปปี้เพย์ (ประเทศไทย)
  ('seed-13', NULL, 'btsบางกอกสมารทการดซสเทม', 'builtin-transport', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- BTS บางกอก สมาร์ทการ์ด
  ('seed-14', NULL, 'btstim', 'builtin-transport', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- QR PAYMENT AT BTS TIM...
  ('seed-15', NULL, 'ดแทคเตมเงนdtac', 'builtin-phone', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- ดีแทคเติมเงิน dtac
  ('seed-16', NULL, 'เอไอเอสวนทคอลais', 'builtin-phone', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- เอไอเอส วัน-ทู-คอล AIS
  ('seed-17', NULL, 'อเมซอนคงพนมคงพนม', 'builtin-food', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- อเมซอน-คงพนม
  ('seed-18', NULL, 'ฟดปารดเซนทรลเวลด', 'builtin-food', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- ฟู้ด ปาร์ด เซ็นทรัลเวิลด์
  ('seed-19', NULL, 'foodcourttrama', 'builtin-food', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- Food Court-T21 Rama
  ('seed-20', NULL, 'คอคาเฟนสนศารตนมธยสถถาวร', 'builtin-food', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- คอ คาเฟ่
  ('seed-21', NULL, 'ลอวสนpสถาบนเทคโนโลยพระจอมเกลาเจาคณทหาสหลอวสน', 'builtin-food', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- ลอว์สัน
  ('seed-22', NULL, 'นตบคคลอาคารชดแชปเตอรวนโมเดรนด', 'builtin-home', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- นิติบุคคลอาคารชุด แชปเตอร์วัน
  ('seed-23', NULL, 'อนเตอรเรสซเดนซเซอรวส', 'builtin-home', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'), -- อินเตอร์ เรสซิเดนซ์ เซอร์วิส
  ('seed-24', NULL, 'เดอะเฟลกซพรอพเพอรต', 'builtin-home', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'); -- เดอะ เฟลิกซ์ พร็อพเพอร์ตี้