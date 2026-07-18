-- JCR follow-up (perf advisor): 4 JCR policies used bare auth.uid(), which is
-- re-evaluated per row. Recreate with (select auth.uid()) — same fix as the
-- 20260619 rls_initplan_optimize_* migrations; behavior identical.
DROP POLICY IF EXISTS "Users read own recall projection" ON public.epistemic_recall_documents;
CREATE POLICY "Users read own recall projection"
  ON public.epistemic_recall_documents FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own recall projection state" ON public.epistemic_recall_projection_state;
CREATE POLICY "Users read own recall projection state"
  ON public.epistemic_recall_projection_state FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own epistemic erasure receipts" ON public.epistemic_erasure_receipts;
CREATE POLICY "Users read own epistemic erasure receipts"
  ON public.epistemic_erasure_receipts FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own epistemic restore receipts" ON public.epistemic_restore_receipts;
CREATE POLICY "Users read own epistemic restore receipts"
  ON public.epistemic_restore_receipts FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
