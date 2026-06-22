-- Backend audit (auth_rls_initplan): policies calling auth.uid()/auth.role()
-- directly re-evaluate them per-row. Wrap in (select ...) so evaluated once per
-- query. Behavior-preserving; ALTER POLICY keeps command/roles intact.
-- Applied to remote 2026-06-19.

ALTER POLICY "Users can CRUD own accuracy_ratings" ON public.accuracy_ratings USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "agent_activities_delete_own" ON public.agent_activities USING ((select auth.uid()) = user_id);
ALTER POLICY "agent_activities_insert_own" ON public.agent_activities WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "agent_activities_select_own" ON public.agent_activities USING ((select auth.uid()) = user_id);

ALTER POLICY "agent_chains_delete_own" ON public.agent_chains USING ((select auth.uid()) = user_id);
ALTER POLICY "agent_chains_insert_own" ON public.agent_chains WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "agent_chains_select_own" ON public.agent_chains USING ((select auth.uid()) = user_id);
ALTER POLICY "agent_chains_update_own" ON public.agent_chains USING ((select auth.uid()) = user_id);

ALTER POLICY "agents_delete_own" ON public.agents USING ((select auth.uid()) = user_id);
ALTER POLICY "agents_insert_own" ON public.agents WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "agents_select_own" ON public.agents USING ((select auth.uid()) = user_id);
ALTER POLICY "agents_update_own" ON public.agents USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can manage own decision_quality_scores" ON public.decision_quality_scores USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own feedback_records" ON public.feedback_records USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users see own human agent messages" ON public.human_agent_messages USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own judgment_records" ON public.judgment_records USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can manage own outcome_records" ON public.outcome_records USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own personas" ON public.personas USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own plugin_bearings" ON public.plugin_bearings USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own plugin_decisions" ON public.plugin_decisions USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users manage own progressive sessions" ON public.progressive_sessions USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own projects" ON public.projects USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete own signals" ON public.quality_signals USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own signals" ON public.quality_signals WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can read own signals" ON public.quality_signals USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can only read own rate_limits" ON public.rate_limits USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own recast_items" ON public.recast_items USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own reframe_items" ON public.reframe_items USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can CRUD own synthesize_items" ON public.synthesize_items USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can manage own retrospective_answers" ON public.retrospective_answers USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete own slack_connections" ON public.slack_connections USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own slack_connections" ON public.slack_connections WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can read own slack_connections" ON public.slack_connections USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own slack_connections" ON public.slack_connections USING ((select auth.uid()) = user_id);

ALTER POLICY "Service role can read events" ON public.user_events USING ((select auth.role()) = 'service_role'::text);
