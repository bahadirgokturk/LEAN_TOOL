  // UTILITIES
  // ================================================================
  // Single system admin — the only account that can assign the management role.
  // Must match the hard-coded email in set_user_management_flag (migration 0013).
  const SUPER_ADMIN_EMAIL = 'batuhan.pancarci@saueressig-tr.com';

  function generateUUID() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function toISODate(date = new Date()) { return date.toISOString().split('T')[0]; }
  function toISODateTime(date = new Date()) { return date.toISOString(); }

  function workingDaysBetween(startISO, endISO) {
    let count = 0;
    const cur = new Date(startISO), end = new Date(endISO);
    while (cur <= end) { const d = cur.getDay(); if (d !== 0 && d !== 6) count++; cur.setDate(cur.getDate()+1); }
    return count;
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const SAFE_GROUP_COLOR = /^#[0-9a-f]{6}$/i;
  function normalizeGroupColor(value) {
    return typeof value === 'string' && SAFE_GROUP_COLOR.test(value.trim())
      ? value.trim().toUpperCase()
      : '#2563EB';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' });
  }

  function fmtMoney(n, currency = 'TRY') {
    if (!n) return '—';
    return Number(n).toLocaleString('tr-TR') + ' ' + currency;
  }

  // ================================================================
  // DATA STORE — Supabase-backed (rewritten from the original localStorage DS)
  // ================================================================
  //
  // Design: render call-sites in this file call DS.list*/DS.get* SYNCHRONOUSLY, exactly
  // like the old localStorage version. To keep every render function unchanged we keep an
  // in-memory cache (_cache) shaped like the old localStorage data (camelCase fields,
  // assignees/dependencies/attendees/agenda inlined as arrays). AppState.setActiveProject
  // fetches everything for a project up front and populates _cache; DS.list*/get* just
  // read from it. DS.create*/update*/delete* are now async: they call Supabase, patch
  // _cache from the real response, and return the result — callers already using
  // `await DS.create...()` style get updated call sites (see call-site edits below).
  //
  // Field name mapping (camelCase <-> snake_case) happens only inside this DS layer.
  const supabase = window.__supabase;

  // TODO: realtime — Supabase Realtime subscriptions on `activities` and `actions`
  // (and friends) would let concurrent PM/member sessions see live updates without a
  // manual refresh. Not implemented in this pass; every render is driven by the cache
  // populated at project-open time and after each mutation.

  const _cache = {
    project: null,       // current project row (camelCase)
    members: [],
    groups: [],
    activities: [],      // includes .assignees (string[]) and .dependencies ({activityId,type,lag}[])
    meetings: [],         // includes .attendees (string[]) and .agenda ({id,topic,duration,presenter,order}[])
    actions: [],
    ailogs: [],
    allProjects: [],      // dashboard list (lightweight, no children)
  };

  function mapProjectRow(p) {
    if (!p) return null;
    return {
      id: p.id, name: p.name, code: p.code, description: p.description || '',
      status: p.status, startDate: p.start_date, endDate: p.end_date,
      baselineStartDate: p.baseline_start_date, baselineEndDate: p.baseline_end_date,
      budget: { total: Number(p.budget_total) || 0, currency: p.budget_currency || 'TRY', spent: Number(p.budget_spent) || 0 },
      createdAt: p.created_at, updatedAt: p.updated_at, createdBy: p.created_by,
    };
  }
  function mapMemberRow(m) {
    return {
      id: m.id, projectId: m.project_id, userId: m.user_id, name: m.name, surname: m.surname,
      email: m.email, department: m.department || '', role: m.role,
      capacity: Number(m.capacity) || 8, createdAt: m.created_at,
    };
  }
  function mapGroupRow(g) {
    return {
      id: g.id, projectId: g.project_id, name: g.name, wbsCode: g.wbs_code || '',
      wbsManual: !!g.wbs_manual,
      parentId: g.parent_id, order: g.sort_order || 0, color: g.color || '#2563EB',
    };
  }
  function mapActivityRow(a, assigneesByActivity, depsByActivity) {
    return {
      id: a.id, projectId: a.project_id, groupId: a.group_id, wbsCode: a.wbs_code || '',
      name: a.name, description: a.description || '', status: a.status, priority: a.priority,
      assignees: (assigneesByActivity[a.id] || []).slice(),
      startDate: a.start_date, endDate: a.end_date,
      baselineStartDate: a.baseline_start_date, baselineEndDate: a.baseline_end_date,
      order: a.sort_order || 0, duration: Number(a.duration_days) || 0,
      percentComplete: Number(a.percent_complete) || 0,
      dependencies: (depsByActivity[a.id] || []).slice(),
      cost: { planned: Number(a.cost_planned) || 0, actual: Number(a.cost_actual) || 0 },
      milestoneFlag: !!a.milestone_flag, notes: a.notes || '',
      wbsManual: !!a.wbs_manual,
      completedAt: a.completed_at || null,
      createdAt: a.created_at, updatedAt: a.updated_at,
    };
  }
  function mapMeetingRow(m, attendeesByMeeting, agendaByMeeting) {
    return {
      id: m.id, projectId: m.project_id, title: m.title, date: m.meeting_date,
      location: m.location || '', attendees: (attendeesByMeeting[m.id] || []).slice(),
      agenda: (agendaByMeeting[m.id] || []).slice(),
      notes: m.notes || '', status: m.status, createdAt: m.created_at,
    };
  }
  function mapActionRow(a) {
    return {
      id: a.id, projectId: a.project_id, meetingId: a.meeting_id, title: a.title,
      description: a.description || '', assignee: a.assignee_member_id, dueDate: a.due_date,
      status: a.status, priority: a.priority, relatedActivityId: a.related_activity_id,
      createdAt: a.created_at, updatedAt: a.updated_at,
    };
  }
  function mapAILogRow(l) {
    return { id: l.id, projectId: l.project_id, type: l.log_type, prompt: l.prompt || '', response: l.response || '', createdAt: l.created_at };
  }

  function throwIfError(res, fallbackMsg) {
    if (res && res.error) throw new Error(res.error.message || fallbackMsg || 'Supabase hatası');
    return res;
  }

  const DS = {
    // ---- Bulk project-scoped fetch (called by AppState.setActiveProject) ----
    async loadProjectData(pid) {
      const [projRes, membersRes, groupsRes, actsRes, assigneesRes, depsRes,
             meetingsRes, attendeesRes, agendaRes, actionsRes, ailogsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', pid).maybeSingle(),
        supabase.from('project_members').select('*').eq('project_id', pid).order('created_at'),
        supabase.from('activity_groups').select('*').eq('project_id', pid).order('sort_order'),
        supabase.from('activities').select('*').eq('project_id', pid).order('sort_order'),
        supabase.from('activity_assignees').select('activity_id, member_id'),
        supabase.from('activity_dependencies').select('*'),
        supabase.from('meetings').select('*').eq('project_id', pid),
        supabase.from('meeting_attendees').select('meeting_id, member_id'),
        supabase.from('meeting_agenda_items').select('*').order('sort_order'),
        supabase.from('actions').select('*').eq('project_id', pid),
        supabase.from('ai_logs').select('*').eq('project_id', pid).order('created_at'),
      ]);
      [projRes, membersRes, groupsRes, actsRes, meetingsRes, actionsRes, ailogsRes].forEach(r => throwIfError(r));

      const actIds = new Set((actsRes.data || []).map(a => a.id));
      const meetIds = new Set((meetingsRes.data || []).map(m => m.id));

      const assigneesByActivity = {};
      (assigneesRes.data || []).forEach(row => {
        if (!actIds.has(row.activity_id)) return;
        (assigneesByActivity[row.activity_id] ||= []).push(row.member_id);
      });
      const depsByActivity = {};
      (depsRes.data || []).forEach(row => {
        if (!actIds.has(row.activity_id)) return;
        (depsByActivity[row.activity_id] ||= []).push({ activityId: row.depends_on_activity_id, type: row.dep_type || 'FS', lag: Number(row.lag_days) || 0 });
      });
      const attendeesByMeeting = {};
      (attendeesRes.data || []).forEach(row => {
        if (!meetIds.has(row.meeting_id)) return;
        (attendeesByMeeting[row.meeting_id] ||= []).push(row.member_id);
      });
      const agendaByMeeting = {};
      (agendaRes.data || []).forEach(row => {
        if (!meetIds.has(row.meeting_id)) return;
        (agendaByMeeting[row.meeting_id] ||= []).push({
          id: row.id, topic: row.topic, duration: row.duration_minutes || 0,
          presenter: row.presenter_member_id, order: row.sort_order || 0,
        });
      });

      _cache.project = mapProjectRow(projRes.data);
      _cache.members = (membersRes.data || []).map(mapMemberRow);
      _cache.groups = (groupsRes.data || []).map(mapGroupRow);
      _cache.activities = (actsRes.data || []).map(a => mapActivityRow(a, assigneesByActivity, depsByActivity));
      _cache.meetings = (meetingsRes.data || []).map(m => mapMeetingRow(m, attendeesByMeeting, agendaByMeeting));
      _cache.actions = (actionsRes.data || []).map(mapActionRow);
      _cache.ailogs = (ailogsRes.data || []).map(mapAILogRow);
    },

    clearProjectCache() {
      _cache.project = null; _cache.members = []; _cache.groups = [];
      _cache.activities = []; _cache.meetings = []; _cache.actions = []; _cache.ailogs = [];
    },

    // ---- Projects ----
    async loadAllProjects() {
      const res = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      throwIfError(res);
      _cache.allProjects = (res.data || []).map(mapProjectRow);
      return _cache.allProjects;
    },
    // Per-project rollup stats for the dashboard cards (member/activity counts,
    // progress, delayed, spent) — one RPC instead of loading every project's
    // full data. Keyed by project id in _cache.dashStats.
    async loadDashboardStats() {
      const res = await supabase.rpc('get_project_dashboard_stats');
      if (res.error) { console.error('[loadDashboardStats]', res.error); _cache.dashStats = {}; return {}; }
      const map = {};
      (res.data || []).forEach(r => { map[r.project_id] = r; });
      _cache.dashStats = map;
      return map;
    },
    getDashboardStats(pid) { return (_cache.dashStats && _cache.dashStats[pid]) || null; },
    listProjects() { return _cache.allProjects; },
    getProject(id) {
      if (_cache.project && _cache.project.id === id) return _cache.project;
      return _cache.allProjects.find(p => p.id === id) || null;
    },
    async createProjectWithPM(f, pmName, pmSurname) {
      const res = await supabase.rpc('create_project_with_pm', {
        p_name: f.name || '', p_code: f.code || '', p_description: f.description || '',
        p_pm_name: pmName || '', p_pm_surname: pmSurname || '',
      });
      throwIfError(res, 'Proje oluşturulamadı');
      const proj = mapProjectRow(res.data);
      // Fill in the rest of the wizard fields (dates/budget) with a follow-up update.
      const updated = await DS.updateProject(proj.id, {
        startDate: f.startDate, endDate: f.endDate,
        baselineStartDate: f.baselineStartDate, baselineEndDate: f.baselineEndDate,
        budget: f.budget,
      });
      _cache.allProjects.unshift(updated || proj);
      return updated || proj;
    },
    async updateProject(id, f) {
      const patch = {};
      if ('name' in f) patch.name = f.name;
      if ('description' in f) patch.description = f.description;
      if ('status' in f) patch.status = f.status;
      if ('startDate' in f) patch.start_date = f.startDate || null;
      if ('endDate' in f) patch.end_date = f.endDate || null;
      if ('baselineStartDate' in f) patch.baseline_start_date = f.baselineStartDate || null;
      if ('baselineEndDate' in f) patch.baseline_end_date = f.baselineEndDate || null;
      if (f.budget) {
        patch.budget_total = Number(f.budget.total) || 0;
        patch.budget_currency = f.budget.currency || 'TRY';
      }
      const res = await supabase.from('projects').update(patch).eq('id', id).select().maybeSingle();
      throwIfError(res, 'Proje güncellenemedi');
      const updated = mapProjectRow(res.data);
      if (_cache.project && _cache.project.id === id) _cache.project = updated;
      const idx = _cache.allProjects.findIndex(p => p.id === id);
      if (idx >= 0) _cache.allProjects[idx] = updated;
      return updated;
    },
    async deleteProject(id) {
      const res = await supabase.from('projects').delete().eq('id', id);
      throwIfError(res, 'Proje silinemedi');
      _cache.allProjects = _cache.allProjects.filter(p => p.id !== id);
      if (_cache.project && _cache.project.id === id) DS.clearProjectCache();
    },
    isProjectCodeUnique(code, excludeId = null) {
      return _cache.allProjects.every(p => p.id === excludeId || p.code.toUpperCase() !== code.toUpperCase());
    },

    // ---- Members ----
    listMembers(pid) { return _cache.members; },
    getMember(pid, mid) { return _cache.members.find(m => m.id === mid) || null; },
    async createMember(pid, f) {
      const res = await supabase.from('project_members').insert({
        project_id: pid, user_id: null, name: f.name || '', surname: f.surname || '',
        email: f.email || '', department: f.department || '', role: f.role || 'member',
        capacity: Number(f.capacity) || 8,
      }).select().single();
      throwIfError(res, 'Ekip üyesi eklenemedi');
      const m = mapMemberRow(res.data);
      _cache.members.push(m);
      return m;
    },
    async updateMember(pid, mid, f) {
      const patch = {};
      if ('name' in f) patch.name = f.name;
      if ('surname' in f) patch.surname = f.surname;
      if ('email' in f) patch.email = f.email;
      if ('department' in f) patch.department = f.department;
      if ('role' in f) patch.role = f.role;
      if ('capacity' in f) patch.capacity = Number(f.capacity) || 8;
      const res = await supabase.from('project_members').update(patch).eq('id', mid).select().maybeSingle();
      throwIfError(res, 'Ekip üyesi güncellenemedi');
      const updated = mapMemberRow(res.data);
      const idx = _cache.members.findIndex(m => m.id === mid);
      if (idx >= 0) _cache.members[idx] = updated;
      return updated;
    },
    async deleteMember(pid, mid) {
      const res = await supabase.from('project_members').delete().eq('id', mid);
      throwIfError(res, 'Ekip üyesi silinemedi');
      _cache.members = _cache.members.filter(m => m.id !== mid);
    },

    // ---- Groups ----
    listGroups(pid) { return _cache.groups; },
    getGroup(pid, gid) { return _cache.groups.find(g => g.id === gid) || null; },
    async createGroup(pid, f) {
      const res = await supabase.from('activity_groups').insert({
        project_id: pid, name: f.name || '', wbs_code: f.wbsCode || '', wbs_manual: !!f.wbsManual,
        parent_id: f.parentId || null, sort_order: Number(f.order) || 0, color: normalizeGroupColor(f.color),
      }).select().single();
      throwIfError(res, 'Grup oluşturulamadı');
      const g = mapGroupRow(res.data);
      _cache.groups.push(g);
      return g;
    },
    async updateGroup(pid, gid, f) {
      const patch = {};
      if ('name' in f) patch.name = f.name;
      if ('wbsCode' in f) patch.wbs_code = f.wbsCode;
      if ('wbsManual' in f) patch.wbs_manual = !!f.wbsManual;
      if ('parentId' in f) patch.parent_id = f.parentId || null;
      if ('order' in f) patch.sort_order = Number(f.order) || 0;
      if ('color' in f) patch.color = normalizeGroupColor(f.color);
      const res = await supabase.from('activity_groups').update(patch).eq('id', gid).select().maybeSingle();
      throwIfError(res, 'Grup güncellenemedi');
      const updated = mapGroupRow(res.data);
      const idx = _cache.groups.findIndex(g => g.id === gid);
      if (idx >= 0) _cache.groups[idx] = updated;
      return updated;
    },
    async deleteGroup(pid, gid) {
      const res = await supabase.from('activity_groups').delete().eq('id', gid);
      throwIfError(res, 'Grup silinemedi');
      _cache.groups = _cache.groups.filter(g => g.id !== gid);
    },

    // ---- Activities ----
    listActivities(pid) { return _cache.activities; },
    getActivity(pid, aid) { return _cache.activities.find(a => a.id === aid) || null; },

    async _syncAssignees(activityId, assignees) {
      const current = (DS.getActivity(null, activityId)?.assignees) || [];
      const toAdd = assignees.filter(id => !current.includes(id));
      const toRemove = current.filter(id => !assignees.includes(id));
      if (toRemove.length) {
        await supabase.from('activity_assignees').delete().eq('activity_id', activityId).in('member_id', toRemove);
      }
      if (toAdd.length) {
        await supabase.from('activity_assignees').insert(toAdd.map(mid => ({ activity_id: activityId, member_id: mid })));
      }
    },
    async _syncDependencies(activityId, dependencies) {
      // Simplest correct approach: replace all dependency rows for this activity.
      await supabase.from('activity_dependencies').delete().eq('activity_id', activityId);
      if (dependencies.length) {
        await supabase.from('activity_dependencies').insert(dependencies.map(d => ({
          activity_id: activityId, depends_on_activity_id: d.activityId,
          dep_type: d.type || 'FS', lag_days: Number(d.lag) || 0,
        })));
      }
    },

    async createActivity(pid, f) {
      const res = await supabase.from('activities').insert({
        project_id: pid, group_id: f.groupId || null, wbs_code: f.wbsCode || '',
        name: f.name || '', description: f.description || '', status: f.status || 'not_started',
        priority: f.priority || 'medium', start_date: f.startDate || null, end_date: f.endDate || null,
        baseline_start_date: f.baselineStartDate || null, baseline_end_date: f.baselineEndDate || null,
        sort_order: Number(f.order) || 0, duration_days: Number(f.duration) || 0,
        percent_complete: Number(f.percentComplete) || 0,
        cost_planned: Number(f.cost?.planned) || 0, cost_actual: Number(f.cost?.actual) || 0,
        milestone_flag: !!f.milestoneFlag, notes: f.notes || '',
      }).select().single();
      throwIfError(res, 'Aktivite oluşturulamadı');
      const a = mapActivityRow(res.data, {}, {});
      if (f.assignees && f.assignees.length) {
        await DS._syncAssignees(a.id, f.assignees);
        a.assignees = f.assignees.slice();
      }
      _cache.activities.push(a);
      return a;
    },
    async updateActivity(pid, aid, f) {
      const patch = {};
      if ('name' in f) patch.name = f.name;
      if ('wbsCode' in f) patch.wbs_code = f.wbsCode;
      if ('wbsManual' in f) patch.wbs_manual = !!f.wbsManual;
      if ('description' in f) patch.description = f.description;
      if ('groupId' in f) patch.group_id = f.groupId || null;
      if ('startDate' in f) patch.start_date = f.startDate || null;
      if ('endDate' in f) patch.end_date = f.endDate || null;
      if ('baselineStartDate' in f) patch.baseline_start_date = f.baselineStartDate || null;
      if ('baselineEndDate' in f) patch.baseline_end_date = f.baselineEndDate || null;
      if ('order' in f) patch.sort_order = Number(f.order) || 0;
      if ('duration' in f) patch.duration_days = Number(f.duration) || 0;
      if ('percentComplete' in f) patch.percent_complete = Number(f.percentComplete) || 0;
      if ('status' in f) {
        patch.status = f.status;
        // Stamp completed_at when moving into 'completed', clear it otherwise, so we can
        // later tell whether a done activity was finished on time or late.
        if (f.status === 'completed') {
          const existing = DS.getActivity(pid, aid);
          patch.completed_at = existing?.completedAt || toISODateTime();
        } else {
          patch.completed_at = null;
        }
      }
      if ('priority' in f) patch.priority = f.priority;
      if ('milestoneFlag' in f) patch.milestone_flag = !!f.milestoneFlag;
      if ('notes' in f) patch.notes = f.notes;
      if (f.cost) { patch.cost_planned = Number(f.cost.planned) || 0; patch.cost_actual = Number(f.cost.actual) || 0; }

      const isPM = AppState.canEdit();
      let updatedRow;
      if (!isPM) {
        // Members: route through the RPC (RLS only allows PM to UPDATE the base table directly).
        const res = await supabase.rpc('update_activity_progress', {
          p_activity_id: aid,
          p_status: f.status || DS.getActivity(pid, aid)?.status || 'not_started',
          p_percent_complete: 'percentComplete' in f ? Number(f.percentComplete) || 0 : (DS.getActivity(pid, aid)?.percentComplete || 0),
          p_notes: 'notes' in f ? (f.notes || '') : (DS.getActivity(pid, aid)?.notes || ''),
        });
        throwIfError(res, 'Aktivite güncellenemedi');
        updatedRow = res.data;
      } else {
        // NOTE: parenthesize — `await X ? Y : Z` binds as `(await X) ? Y : Z`, which would
        // leave the update() builder unexecuted (never awaited) and silently skip the write.
        let res;
        if (Object.keys(patch).length) {
          res = await supabase.from('activities').update(patch).eq('id', aid).select().maybeSingle();
        } else {
          res = { data: null, error: null };
        }
        throwIfError(res, 'Aktivite güncellenemedi');
        updatedRow = res.data;
      }

      const existing = DS.getActivity(pid, aid);
      const merged = updatedRow ? mapActivityRow(updatedRow, {}, {}) : { ...existing };
      merged.assignees = existing ? existing.assignees : [];
      merged.dependencies = existing ? existing.dependencies : [];

      if (isPM && f.assignees) {
        await DS._syncAssignees(aid, f.assignees);
        merged.assignees = f.assignees.slice();
      }
      if (isPM && f.dependencies) {
        await DS._syncDependencies(aid, f.dependencies);
        merged.dependencies = f.dependencies.slice();
      }

      const idx = _cache.activities.findIndex(a => a.id === aid);
      if (idx >= 0) _cache.activities[idx] = merged; else _cache.activities.push(merged);
      return merged;
    },
    cancelActivity(pid, aid) { return DS.updateActivity(pid, aid, { status: 'cancelled' }); },
    async deleteActivity(pid, aid) {
      // Hard delete. FK cascades remove assignee/dependency join rows; other activities
      // that depended on this one lose that dependency (also cascaded) — mirror in cache.
      const res = await supabase.from('activities').delete().eq('id', aid);
      throwIfError(res, 'Aktivite silinemedi');
      _cache.activities = _cache.activities.filter(a => a.id !== aid);
      _cache.activities.forEach(a => {
        if (a.dependencies) a.dependencies = a.dependencies.filter(d => d.activityId !== aid);
      });
    },

    // ---- Meetings ----
    listMeetings(pid) { return _cache.meetings; },
    getMeeting(pid, mid) { return _cache.meetings.find(m => m.id === mid) || null; },
    async _syncAttendees(meetingId, attendees) {
      await supabase.from('meeting_attendees').delete().eq('meeting_id', meetingId);
      if (attendees.length) {
        await supabase.from('meeting_attendees').insert(attendees.map(mid => ({ meeting_id: meetingId, member_id: mid })));
      }
    },
    async _syncAgenda(meetingId, agenda) {
      await supabase.from('meeting_agenda_items').delete().eq('meeting_id', meetingId);
      if (agenda.length) {
        await supabase.from('meeting_agenda_items').insert(agenda.map((item, i) => ({
          meeting_id: meetingId, topic: item.topic || '', duration_minutes: item.duration || null,
          presenter_member_id: item.presenter || null, sort_order: i,
        })));
      }
    },
    async createMeeting(pid, f) {
      const res = await supabase.from('meetings').insert({
        project_id: pid, title: f.title || '', meeting_date: f.date || toISODateTime(),
        location: f.location || '', notes: f.notes || '', status: f.status || 'planned',
      }).select().single();
      throwIfError(res, 'Toplantı oluşturulamadı');
      const m = mapMeetingRow(res.data, {}, {});
      if (f.attendees && f.attendees.length) { await DS._syncAttendees(m.id, f.attendees); m.attendees = f.attendees.slice(); }
      if (f.agenda && f.agenda.length) { await DS._syncAgenda(m.id, f.agenda); m.agenda = f.agenda.slice(); }
      _cache.meetings.push(m);
      return m;
    },
    async updateMeeting(pid, mid, f) {
      const patch = {};
      if ('title' in f) patch.title = f.title;
      if ('date' in f) patch.meeting_date = f.date;
      if ('location' in f) patch.location = f.location;
      if ('notes' in f) patch.notes = f.notes;
      if ('status' in f) patch.status = f.status;
      const res = await supabase.from('meetings').update(patch).eq('id', mid).select().maybeSingle();
      throwIfError(res, 'Toplantı güncellenemedi');
      const existing = DS.getMeeting(pid, mid);
      const merged = mapMeetingRow(res.data, {}, {});
      merged.attendees = existing ? existing.attendees : [];
      merged.agenda = existing ? existing.agenda : [];
      if (f.attendees) { await DS._syncAttendees(mid, f.attendees); merged.attendees = f.attendees.slice(); }
      if (f.agenda) { await DS._syncAgenda(mid, f.agenda); merged.agenda = f.agenda.slice(); }
      const idx = _cache.meetings.findIndex(m => m.id === mid);
      if (idx >= 0) _cache.meetings[idx] = merged;
      return merged;
    },
    async deleteMeeting(pid, mid) {
      // FK is ON DELETE SET NULL for actions.meeting_id, so deleting the meeting
      // automatically detaches its actions server-side — mirror that in the cache.
      const res = await supabase.from('meetings').delete().eq('id', mid);
      throwIfError(res, 'Toplantı silinemedi');
      _cache.actions.forEach(a => { if (a.meetingId === mid) a.meetingId = null; });
      _cache.meetings = _cache.meetings.filter(m => m.id !== mid);
    },

    // ---- Actions ----
    listActions(pid) { return _cache.actions; },
    getAction(pid, aid) { return _cache.actions.find(a => a.id === aid) || null; },
    async createAction(pid, f) {
      const res = await supabase.from('actions').insert({
        project_id: pid, meeting_id: f.meetingId || null, title: f.title || '',
        description: f.description || '', assignee_member_id: f.assignee || null,
        due_date: f.dueDate || null, status: f.status || 'open', priority: f.priority || 'medium',
        related_activity_id: f.relatedActivityId || null,
      }).select().single();
      throwIfError(res, 'Aksiyon oluşturulamadı');
      const a = mapActionRow(res.data);
      _cache.actions.push(a);
      return a;
    },
    async updateAction(pid, aid, f) {
      const isPM = AppState.canEdit();
      let updatedRow;
      if (!isPM && Object.keys(f).length === 1 && 'status' in f) {
        const res = await supabase.rpc('update_action_status', { p_action_id: aid, p_status: f.status });
        throwIfError(res, 'Aksiyon güncellenemedi');
        updatedRow = res.data;
      } else {
        const patch = {};
        if ('title' in f) patch.title = f.title;
        if ('description' in f) patch.description = f.description;
        if ('assignee' in f) patch.assignee_member_id = f.assignee || null;
        if ('dueDate' in f) patch.due_date = f.dueDate || null;
        if ('status' in f) patch.status = f.status;
        if ('priority' in f) patch.priority = f.priority;
        if ('relatedActivityId' in f) patch.related_activity_id = f.relatedActivityId || null;
        if ('meetingId' in f) patch.meeting_id = f.meetingId || null;
        const res = await supabase.from('actions').update(patch).eq('id', aid).select().maybeSingle();
        throwIfError(res, 'Aksiyon güncellenemedi');
        updatedRow = res.data;
      }
      const updated = mapActionRow(updatedRow);
      const idx = _cache.actions.findIndex(a => a.id === aid);
      if (idx >= 0) _cache.actions[idx] = updated; else _cache.actions.push(updated);
      return updated;
    },
    async deleteAction(pid, aid) {
      const res = await supabase.from('actions').delete().eq('id', aid);
      throwIfError(res, 'Aksiyon silinemedi');
      _cache.actions = _cache.actions.filter(a => a.id !== aid);
    },
    async syncOverdueActions(pid) {
      // Best-effort client-side flagging only (server keeps `status` authoritative via RLS-guarded
      // writes); PMs get this for free via the normal update path, members can't write this anyway.
      if (!AppState.canEdit()) return;
      const today = toISODate();
      const stale = _cache.actions.filter(a => (a.status === 'open' || a.status === 'in_progress') && a.dueDate && a.dueDate < today);
      for (const a of stale) {
        try { await DS.updateAction(pid, a.id, { status: 'overdue' }); } catch { /* ignore */ }
      }
    },

    // ---- AI Logs ---- (read-only from the client now; /api/ai writes these server-side)
    listAILogs(pid) { return _cache.ailogs; },
    async reloadAILogs(pid) {
      const res = await supabase.from('ai_logs').select('*').eq('project_id', pid).order('created_at');
      throwIfError(res);
      _cache.ailogs = (res.data || []).map(mapAILogRow);
      return _cache.ailogs;
    },

    // ---- Session / role resolution (see AppState.resolveAccess) ----
    getSession() { return AppState.session; },

    // ---- Settings ---- (apiKey removed: the Anthropic key now lives server-side only, see /api/ai)
    getSettings() { return _get_local_settings(); },
    updateSettings(f) { _set_local_settings({ ..._get_local_settings(), ...f }); },

    // ---- Computed helpers (unchanged logic, now reading from _cache) ----
    getProjectProgress(pid) {
      const acts = _cache.activities.filter(a => a.status !== 'cancelled');
      if (!acts.length) return 0;
      const totalDur = acts.reduce((s, a) => s + (a.duration || 1), 0);
      const done = acts.reduce((s, a) => s + ((a.percentComplete / 100) * (a.duration || 1)), 0);
      return Math.round((done / totalDur) * 100);
    },
    getDelayedActivities(pid) {
      const today = toISODate();
      return _cache.activities.filter(a =>
        a.status !== 'cancelled' && a.status !== 'completed' && a.endDate && a.endDate < today && a.percentComplete < 100);
    },
    getAtRiskActivities(pid) {
      const today = toISODate();
      return _cache.activities.filter(a => {
        if (a.status === 'cancelled' || a.status === 'completed') return false;
        if (!a.endDate || a.endDate <= today) return false;
        return workingDaysBetween(today, a.endDate) <= 3 && a.percentComplete < 100;
      });
    },
    getProjectHealth(pid) {
      const p = DS.getProject(pid); if (!p) return 'healthy';
      const delayed = DS.getDelayedActivities(pid);
      const b = p.budget, costVar = b.total > 0 ? Math.abs((b.spent - b.total) / b.total) * 100 : 0;
      if (delayed.length >= 3 || costVar > 15) return 'critical';
      if (delayed.length >= 1 || (costVar > 5 && costVar <= 15)) return 'caution';
      return 'healthy';
    },
  };

  // Local-only, non-sensitive UI preference storage (theme). No API key is ever stored here.
  const LOCAL_SETTINGS_KEY = 'pm_tool_local_settings';
  function _get_local_settings() {
    try { const r = localStorage.getItem(LOCAL_SETTINGS_KEY); return r !== null ? JSON.parse(r) : { theme: 'light' }; }
    catch { return { theme: 'light' }; }
  }
  function _set_local_settings(v) {
    try { localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(v)); } catch { /* ignore */ }
  }

  // ================================================================
  // ROUTER
  // ================================================================
  const ROUTE_LABELS = {
    dashboard:'Tüm Projeler', activities:'Aktiviteler', gantt:'Gantt Şeması',
    tracking:'İzleme', meetings:'Toplantılar', actions:'Aksiyonlar',
    reports:'Raporlar', ai:'AI Asistan', members:'Ekip Üyeleri', settings:'Proje Ayarları',
  };
  const PROJECT_VIEWS = new Set(['activities','gantt','tracking','meetings','actions','reports','ai','members','settings']);

  const Router = {
    currentView: 'dashboard',
    init() { window.addEventListener('hashchange', ()=>this._onHashChange()); this._onHashChange(); },
    navigate(view) {
      // Setting the hash to its current value does NOT fire hashchange, so navigating to
      // the view you're already on (e.g. switching projects while on #activities) would
      // leave the old project's data on screen. Force a re-activation in that case.
      if (window.location.hash === '#' + view) { this._activate(view); }
      else { window.location.hash = view; }
    },
    _onHashChange() { this._activate(window.location.hash.replace('#','') || 'dashboard'); },
    _activate(view) {
      if(!ROUTE_LABELS[view]) view='dashboard';
      if(PROJECT_VIEWS.has(view)&&!AppState.activeProjectId) { this.navigate('dashboard'); return; }
      if(view==='reports'&&!AppState.canViewReports()) { this.navigate('activities'); return; }
      document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
      const t=document.getElementById(`view-${view}`); if(t) t.classList.add('active');
      document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active', el.dataset.view===view));
      const proj=AppState.activeProjectId?DS.getProject(AppState.activeProjectId):null;
      const bp=document.getElementById('breadcrumb-project');
      const bs=document.getElementById('breadcrumb-sep');
      const bv=document.getElementById('breadcrumb-view');
      if(proj&&view!=='dashboard') {
        bp.textContent=proj.name; bp.style.display=''; bs.style.display=''; bv.textContent=ROUTE_LABELS[view]||view;
      } else {
        bp.style.display='none'; bs.style.display='none'; bv.textContent=ROUTE_LABELS[view]||view;
      }
      this.currentView=view;
      document.dispatchEvent(new CustomEvent('viewActivated',{detail:{view}}));
    },
  };

  // ================================================================
  // REALTIME — live multi-user sync for the active project
  // ================================================================
  // Subscribes to Postgres changes on the active project's tables. On any change
  // (from any user), the project cache is reloaded and the current view re-rendered,
  // so two people looking at the same project stay in sync without a manual refresh.
  // RLS applies to realtime too, so a client only receives events for rows it can read.
  let _rtChannel = null;
  let _rtReloadTimer = null;

  function rerenderCurrentView() {
    const map = {
      dashboard: renderDashboard, members: renderMembersView, settings: renderSettingsView,
      activities: renderActivitiesView, gantt: renderGanttView, tracking: renderTrackingView,
      meetings: renderMeetingsView, actions: renderActionsView, ai: renderAIView,
    };
    (map[Router.currentView] || function(){})();
  }

  function _scheduleRealtimeReload() {
    // Debounce: a single logical change can fire several row events (e.g. an activity
    // plus its assignee join rows) — coalesce them into one reload.
    clearTimeout(_rtReloadTimer);
    _rtReloadTimer = setTimeout(async () => {
      const pid = AppState.activeProjectId;
      if (!pid) return;
      try {
        await DS.loadProjectData(pid);
        rerenderCurrentView();
      } catch (e) { console.error('[realtime reload]', e); }
    }, 400);
  }

  function subscribeRealtime(pid) {
    unsubscribeRealtime();
    if (!pid || !supabase?.channel) return;
    const ch = supabase.channel('project-' + pid);
    // Tables carrying project_id → filter to this project.
    ['activities','activity_groups','meetings','actions','project_members'].forEach(table => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `project_id=eq.${pid}` }, _scheduleRealtimeReload);
    });
    // Join tables have no project_id column → no filter (RLS still limits events to rows
    // this user can read, i.e. their own projects).
    ['activity_assignees','activity_dependencies','meeting_attendees','meeting_agenda_items'].forEach(table => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, _scheduleRealtimeReload);
    });
    ch.subscribe();
    _rtChannel = ch;
  }

  function unsubscribeRealtime() {
    if (_rtChannel) { try { supabase.removeChannel(_rtChannel); } catch { /* ignore */ } _rtChannel = null; }
    clearTimeout(_rtReloadTimer);
  }

  // ================================================================
  // APP STATE
  // ================================================================
  //
  // Auth rewrite: role/identity now derive from the authenticated Supabase user instead
  // of a client-trusted, spoofable session object typed into a PIN screen. AppState.session
  // is still shaped like {role, memberId, memberName, projectId} so canEdit()/
  // canUpdateOwnActivity()/canViewReports() keep the exact same call sites/logic —
  // it's just resolved server-side (via resolveAccess()) instead of user-picked.
  // This is UX-only gating (hide/show buttons); real enforcement is RLS on the DB.
  const AppState = {
    activeProjectId: null,
    session: null,
    authUser: null, // Supabase auth user object {id, email, ...}

    async setActiveProject(id) {
      this.activeProjectId = id;
      // Remember the open project so a page refresh restores it (see restoreActiveProject
      // in boot) instead of bouncing back to the dashboard. Non-sensitive: RLS still guards data.
      try {
        if (id) localStorage.setItem('pm_active_project', id);
        else localStorage.removeItem('pm_active_project');
      } catch { /* ignore */ }
      if (id) {
        await DS.loadProjectData(id);
        subscribeRealtime(id);
      } else {
        unsubscribeRealtime();
        DS.clearProjectCache();
      }
      const proj = id ? DS.getProject(id) : null;
      const el = document.getElementById('sidebar-project-text');
      if (el) el.textContent = proj ? proj.name : 'Proje seçilmedi';
      const nav = document.getElementById('project-nav'); if (nav) nav.style.display = id ? '' : 'none';
      const btn = document.getElementById('topbar-settings-btn'); if (btn) btn.style.display = id ? '' : 'none';
    },

    setSession(session) {
      this.session = session;
      const nameEl = document.getElementById('user-name');
      const roleEl = document.getElementById('user-role');
      const avatarEl = document.getElementById('user-avatar');
      if (session) {
        const rl = { pm: 'Proje Yöneticisi', member: 'Ekip Üyesi', management: 'Yönetim' };
        const dn = session.memberName || (this.authUser?.email || 'Kullanıcı');
        const ini = dn.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        if (nameEl) nameEl.textContent = dn;
        if (roleEl) roleEl.textContent = rl[session.role] || session.role;
        if (avatarEl) avatarEl.textContent = ini;
      } else {
        if (nameEl) nameEl.textContent = this.authUser ? this.authUser.email : 'Giriş yapılmadı';
        if (roleEl) roleEl.textContent = '—';
        if (avatarEl) avatarEl.textContent = '?';
      }
      const reportsLink = document.querySelector('.nav-link[data-view="reports"]');
      if (reportsLink) reportsLink.style.display = this.canViewReports() ? '' : 'none';
    },

    // Resolves the current authenticated user's role for a project:
    //   1. claim_project_membership(pid) links any pending invite-by-email row to this user.
    //   2. Look up their project_members row -> role is 'pm' or 'member'.
    //   3. If no membership row, fall back to profiles.is_management -> 'management' (read-only).
    //   4. Otherwise: no access.
    // Returns { role, memberId, memberName } or { role: null } if no access.
    async resolveAccess(pid) {
      if (!this.authUser) return { role: null };
      try { await supabase.rpc('claim_project_membership', { p_project_id: pid }); } catch { /* best-effort */ }

      const { data: memberRows } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', pid)
        .eq('user_id', this.authUser.id)
        .limit(1);
      const myMember = memberRows && memberRows[0];
      if (myMember) {
        return { role: myMember.role === 'pm' ? 'pm' : 'member', memberId: myMember.id, memberName: `${myMember.name} ${myMember.surname}` };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_management, full_name, email')
        .eq('id', this.authUser.id)
        .maybeSingle();
      if (profile && profile.is_management) {
        return { role: 'management', memberId: null, memberName: profile.full_name || profile.email || 'Yönetim' };
      }

      return { role: null };
    },

    canEdit()                    { return this.session?.role === 'pm'; },
    canUpdateOwnActivity(asgns)  { if (this.session?.role === 'pm') return true; if (this.session?.role === 'member') return asgns && asgns.includes(this.session.memberId); return false; },
    // Reports are for PM + management (Genel Müdür/Yardımcısı/Süpervizör) only —
    // team members can see/act on their own activities elsewhere but not the rollup report.
    canViewReports()              { return !!this.session && this.session.role !== 'member'; },
  };

  // ================================================================
  // TOAST
  // ================================================================
  const Toast = {
    show(msg, type='', dur=3000) {
      const c=document.getElementById('toast-container');
      const el=document.createElement('div'); el.className=`toast${type?' '+type:''}`;
      el.textContent=msg; c.appendChild(el);
      requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
      setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),250); }, dur);
    },
    success(m){ this.show(m,'success'); },
    error(m)  { this.show(m,'error'); },
    warning(m){ this.show(m,'warning'); },
  };

  // ================================================================
  // SESSION SCREEN — now just an access-resolution screen, no PIN/role picker.
  // ================================================================
  const SessionScreen = {
    projectId: null,

    show(projectId) {
      this.projectId = projectId;
      const proj = DS.getProject(projectId);
      const screen = document.getElementById('session-screen');
      const titleEl = document.getElementById('session-title');
      const nameEl = document.getElementById('session-project-name');
      const bodyEl = document.getElementById('session-status-body');
      if (titleEl) titleEl.textContent = 'Erişim kontrol ediliyor…';
      if (nameEl) nameEl.textContent = proj ? `"${proj.name}" projesi için yetkiniz doğrulanıyor.` : 'Yetki doğrulanıyor.';
      if (bodyEl) bodyEl.innerHTML = '<div class="spinner" style="color: var(--color-primary);"></div>';
      screen.classList.remove('hidden');
      this._resolve(projectId);
    },

    hide() { document.getElementById('session-screen').classList.add('hidden'); },

    async _resolve(projectId) {
      const access = await AppState.resolveAccess(projectId);
      // Bail if the user navigated away while this was in flight.
      if (AppState.activeProjectId !== projectId) return;

      if (!access.role) {
        const titleEl = document.getElementById('session-title');
        const bodyEl = document.getElementById('session-status-body');
        if (titleEl) titleEl.textContent = 'Erişiminiz yok';
        if (bodyEl) {
          bodyEl.innerHTML = `<div class="alert alert-warning" style="margin:0;">
            Bu projeye erişim yetkiniz bulunmuyor. Proje Yöneticinizden ekibe eklenmenizi isteyin.
          </div>`;
        }
        AppState.setSession(null);
        return;
      }

      AppState.setSession({ role: access.role, memberId: access.memberId, memberName: access.memberName, projectId });
      this.hide();
      Router.navigate('activities');
    },
  };

  // ================================================================
  // DASHBOARD — Project List (Step 1.3)
  // ================================================================
  const STATUS_LABELS = { draft:'Taslak', active:'Aktif', on_hold:'Beklemede', completed:'Tamamlandı', cancelled:'İptal' };

  let _dashFilter = 'all';

  async function renderDashboard() {
    // Dashboard list is a fresh Supabase fetch each time (cheap, RLS-scoped to what the
    // user can see: their own projects + everything if they're `management`).
    await DS.loadAllProjects();
    await DS.loadDashboardStats();
    const projects=DS.listProjects();
    const filtered=_dashFilter==='all'?projects:projects.filter(p=>p.status===_dashFilter);
    const grid=document.getElementById('project-grid');
    const empty=document.getElementById('dash-empty');
    const subtitle=document.getElementById('dash-subtitle');
    if(!grid) return;

    subtitle.textContent=`${projects.length} proje`;

    if(filtered.length===0) {
      grid.innerHTML=''; grid.style.display='none'; empty.style.display='';
      document.getElementById('dash-empty-title').textContent=_dashFilter==='all'?'Henüz proje yok':'Eşleşen proje yok';
      document.getElementById('dash-empty-desc').textContent=_dashFilter==='all'
        ?'Yeni bir proje oluşturun veya mevcut bir projeyi JSON olarak içe aktarın.'
        :'Seçili filtreyle eşleşen proje bulunamadı.';
      return;
    }
    grid.style.display=''; empty.style.display='none';
    grid.innerHTML=filtered.map(p=>buildProjectCard(p)).join('');

    grid.querySelectorAll('.project-card[data-project-id]').forEach(card=>{
      card.addEventListener('click', e=>{
        if(e.target.closest('.project-card-actions')) return;
        openProject(card.dataset.projectId);
      });
      card.addEventListener('keydown', e=>{ if(e.key==='Enter') openProject(card.dataset.projectId); });
    });
    grid.querySelectorAll('[data-action="delete-project"]').forEach(btn=>{
      btn.addEventListener('click', e=>{ e.stopPropagation(); confirmDeleteProject(btn.dataset.id); });
    });
  }

  function buildProjectCard(p) {
    // Per-project aggregates now come from the get_project_dashboard_stats() RPC
    // (loaded once in renderDashboard), so every card shows real numbers — not just
    // the currently-open project. Health is derived here from delayed count + budget
    // variance, matching DS.getProjectHealth().
    const stats = DS.getDashboardStats(p.id) || { member_count:0, activity_count:0, progress:0, delayed_count:0, spent:0 };
    const progress = stats.progress || 0;
    const memberCount = stats.member_count || 0;
    const activityCount = stats.activity_count || 0;
    const delayed = stats.delayed_count || 0;
    const budgetTotal = p.budget?.total || 0;
    const costVar = budgetTotal > 0 ? Math.abs(((stats.spent || 0) - budgetTotal) / budgetTotal) * 100 : 0;
    const health = (delayed >= 3 || costVar > 15) ? 'critical' : (delayed >= 1 || (costVar > 5 && costVar <= 15)) ? 'caution' : 'healthy';
    const members = { length: memberCount };
    const acts = { length: activityCount };
    const barClass=progress>=80?'success':progress>=40?'':'warning';
    const accentMap={draft:'#9CA3AF',active:'#2563EB',on_hold:'#D97706',completed:'#16A34A',cancelled:'#4B5563'};
    const accent=accentMap[p.status]||'#2563EB';
    const badgeMap={draft:'badge-draft',active:'badge-active',completed:'badge-completed',on_hold:'badge-on-hold',cancelled:'badge-cancelled'};

    return `
    <div class="project-card" data-project-id="${p.id}" tabindex="0" role="button">
      <div class="project-card-accent" style="background:${accent};"></div>
      <div class="project-card-body">
        <div class="project-card-header">
          <div class="project-card-name">${escHtml(p.name)}</div>
          <span class="project-card-code">${escHtml(p.code)}</span>
        </div>
        ${p.description?`<div class="project-card-desc">${escHtml(p.description)}</div>`:''}
        <div class="project-card-meta">
          <div class="project-card-meta-item">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}
          </div>
          <div class="project-card-meta-item">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${members.length} üye
          </div>
          <div class="project-card-meta-item">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/></svg>
            ${acts.length} aktivite
          </div>
          ${delayed>0?`<div class="project-card-meta-item" style="color:var(--color-danger);">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ${delayed} gecikmiş
          </div>`:''}
        </div>
        <div class="project-card-progress-row">
          <div class="progress"><div class="progress-bar ${barClass}" style="width:${progress}%;"></div></div>
          <span class="project-card-progress-pct">${progress}%</span>
        </div>
      </div>
      <div class="project-card-footer">
        <div class="project-card-health">
          <span class="health-dot health-${health}"></span>
          <span class="badge ${badgeMap[p.status]||'badge-draft'}">${STATUS_LABELS[p.status]||p.status}</span>
        </div>
        <div class="project-card-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-action="delete-project" data-id="${p.id}" title="Projeyi sil" style="color:var(--color-danger);">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }

  async function openProject(id) {
    await AppState.setActiveProject(id);
    AppState.setSession(null);
    SessionScreen.show(id);
  }

  // On page load, silently re-enter the project the user last had open (persisted in
  // localStorage by setActiveProject) and resolve their role — without forcing a view
  // change, so the current hash (#activities, #gantt, …) is preserved on refresh.
  // Returns true if a project was successfully restored.
  async function restoreActiveProject() {
    let storedId = null;
    try { storedId = localStorage.getItem('pm_active_project'); } catch { /* ignore */ }
    if (!storedId) return false;
    try {
      await AppState.setActiveProject(storedId);
      const access = await AppState.resolveAccess(storedId);
      if (!access.role) {
        await AppState.setActiveProject(null);
        AppState.setSession(null);
        return false;
      }
      AppState.setSession({ role: access.role, memberId: access.memberId, memberName: access.memberName, projectId: storedId });
      return true;
    } catch (e) {
      console.error('[restoreActiveProject]', e);
      try { await AppState.setActiveProject(null); } catch { /* ignore */ }
      AppState.setSession(null);
      return false;
    }
  }

  async function confirmDeleteProject(id) {
    const proj=DS.getProject(id); if(!proj) return;
    if(!window.confirm(`"${proj.name}" projesini silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz.`)) return;
    try {
      await DS.deleteProject(id);
    } catch (err) { Toast.error('Proje silinemedi: '+err.message); return; }
    if(AppState.activeProjectId===id) { await AppState.setActiveProject(null); AppState.setSession(null); }
    Toast.success(`"${proj.name}" projesi silindi.`);
    await renderDashboard();
  }

  // (wireDashboard is defined once, further down, right before importProjectFromJSON —
  // that's the version that actually runs; function declarations in the same scope
  // just overwrite each other, so keeping two of them here was dead-code clutter.)

  // ================================================================
  // WIZARD — New Project (Step 1.4)
  // ================================================================
  const Wizard = {
    currentStep: 1,
    pendingMembers: [],

    open() {
      this.currentStep=1; this.pendingMembers=[];
      this._resetForms(); this._goToStep(1);
      document.getElementById('wizard-overlay').classList.add('open');
    },
    close() { document.getElementById('wizard-overlay').classList.remove('open'); },

    _resetForms() {
      ['wiz-name','wiz-code','wiz-desc','wiz-budget'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      const startEl=document.getElementById('wiz-start'); if(startEl) startEl.value=toISODate();
      const endEl=document.getElementById('wiz-end'); if(endEl) endEl.value='';
      const curEl=document.getElementById('wiz-currency'); if(curEl) curEl.value='TRY';
      ['err-wiz-name','err-wiz-code','err-wiz-start','err-wiz-end'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=''; });
      ['mem-name','mem-surname','mem-dept','mem-email'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      const memRole=document.getElementById('mem-role'); if(memRole) memRole.value='member';
      const memCap=document.getElementById('mem-capacity'); if(memCap) memCap.value='8';
      ['err-wiz-member','err-wiz-team'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=''; });
      const codeEl=document.getElementById('wiz-code'); if(codeEl) codeEl._userEdited=false;
    },

    _goToStep(step) {
      this.currentStep=step;
      [1,2,3].forEach(n=>{ const p=document.getElementById(`wiz-step-${n}`); if(p) p.style.display=n===step?'':'none'; });
      document.querySelectorAll('#wizard-step-indicator .wizard-step').forEach(el=>{
        const s=Number(el.dataset.step);
        el.classList.remove('active','done');
        if(s===step) el.classList.add('active');
        if(s<step) el.classList.add('done');
      });
      const backBtn=document.getElementById('wiz-back-btn');
      const nextBtn=document.getElementById('wiz-next-btn');
      if(backBtn) backBtn.style.display=step>1?'':'none';
      if(step===3) { if(nextBtn) { nextBtn.textContent='Projeyi Oluştur ✓'; nextBtn.disabled=false; } this._renderSummary(); }
      else { if(nextBtn) { nextBtn.textContent='Devam Et →'; nextBtn.disabled=false; } }
      if(step===2) {
        this._renderMemberList();
        // Directory picker → auto-fill the add-member fields.
        populateDirectorySelect('wiz-member-directory', (p) => {
          document.getElementById('mem-name').value = p.name || '';
          document.getElementById('mem-surname').value = p.surname || '';
          document.getElementById('mem-dept').value = p.department || '';
          document.getElementById('mem-email').value = p.email || '';
        });
      }
    },

    async _validateStep1() {
      let valid=true;
      const name=document.getElementById('wiz-name').value.trim();
      const code=document.getElementById('wiz-code').value.trim().toUpperCase();
      const start=document.getElementById('wiz-start').value;
      const end=document.getElementById('wiz-end').value;
      const setErr=(id,msg)=>{ const el=document.getElementById(id); if(el) el.textContent=msg; if(msg) valid=false; };
      setErr('err-wiz-name', name?'':'Proje adı zorunludur.');
      if(!code) setErr('err-wiz-code','Proje kodu zorunludur.');
      else if(!DS.isProjectCodeUnique(code)) setErr('err-wiz-code','Bu kod zaten kullanımda.');
      else setErr('err-wiz-code','');
      setErr('err-wiz-start', start?'':'Başlangıç tarihi zorunludur.');
      if(!end) setErr('err-wiz-end','Bitiş tarihi zorunludur.');
      else if(start&&end<=start) setErr('err-wiz-end','Bitiş tarihi başlangıçtan sonra olmalıdır.');
      else setErr('err-wiz-end','');
      return valid;
    },

    _validateStep2() {
      // The project creator automatically becomes PM via create_project_with_pm(), so a
      // manual "pm" role member is no longer required here — team members added in this
      // step are just regular members (invited by email, linked on their first login).
      const errTeam=document.getElementById('err-wiz-team');
      if(errTeam) errTeam.textContent='';
      return true;
    },

    _addMember() {
      const name=document.getElementById('mem-name').value.trim();
      const surname=document.getElementById('mem-surname').value.trim();
      const dept=document.getElementById('mem-dept').value.trim();
      const role=document.getElementById('mem-role').value;
      const email=document.getElementById('mem-email').value.trim();
      const capacity=Number(document.getElementById('mem-capacity').value)||8;
      const errEl=document.getElementById('err-wiz-member');
      if(!name||!surname) { if(errEl) errEl.textContent='Ad ve soyad zorunludur.'; return; }
      if(errEl) errEl.textContent='';
      const teamErr=document.getElementById('err-wiz-team'); if(teamErr) teamErr.textContent='';
      this.pendingMembers.push({id:generateUUID(), name, surname, dept, role, email, capacity});
      ['mem-name','mem-surname','mem-dept','mem-email'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      const memRole=document.getElementById('mem-role'); if(memRole) memRole.value='member';
      const memCap=document.getElementById('mem-capacity'); if(memCap) memCap.value='8';
      this._renderMemberList();
    },

    _removeMember(idx) { this.pendingMembers.splice(idx,1); this._renderMemberList(); },

    _renderMemberList() {
      const container=document.getElementById('wiz-members-list'); if(!container) return;
      const rl={pm:'PM',member:'Ekip Üyesi',management:'Yönetim'};
      container.innerHTML=this.pendingMembers.map((m,i)=>`
        <div class="member-row">
          <div class="summary-member-avatar">${escHtml(((m.name[0]||'')+(m.surname[0]||'')).toUpperCase())}</div>
          <div class="member-row-info">
            <div class="member-row-name">${escHtml(m.name)} ${escHtml(m.surname)}</div>
            <div class="member-row-meta">${escHtml(rl[m.role]||m.role)}${m.dept?' · '+escHtml(m.dept):''}${m.email?' · '+escHtml(m.email):''} · ${m.capacity}s/gün</div>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm member-row-delete" data-remove-idx="${i}" title="Kaldır">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('');
      container.querySelectorAll('[data-remove-idx]').forEach(btn=>{
        btn.addEventListener('click',()=>this._removeMember(Number(btn.dataset.removeIdx)));
      });
    },

    _renderSummary() {
      const name=document.getElementById('wiz-name').value.trim();
      const code=document.getElementById('wiz-code').value.trim().toUpperCase();
      const desc=document.getElementById('wiz-desc').value.trim();
      const start=document.getElementById('wiz-start').value;
      const end=document.getElementById('wiz-end').value;
      const budget=document.getElementById('wiz-budget').value;
      const currency=document.getElementById('wiz-currency').value;
      const fields=[
        {label:'Proje Adı',value:name},{label:'Proje Kodu',value:code},
        {label:'Başlangıç',value:fmtDate(start)},{label:'Bitiş',value:fmtDate(end)},
        {label:'Bütçe',value:budget?fmtMoney(budget,currency):'—'},{label:'Açıklama',value:desc||'—'},
      ];
      const rl={pm:'PM',member:'Ekip Üyesi',management:'Yönetim'};
      document.getElementById('sum-project-fields').innerHTML=fields.map(f=>`
        <div><div class="summary-item-label">${escHtml(f.label)}</div><div class="summary-item-value">${escHtml(f.value)}</div></div>`).join('');
      document.getElementById('sum-member-count').textContent=this.pendingMembers.length;
      document.getElementById('sum-members-list').innerHTML=this.pendingMembers.map(m=>`
        <div class="summary-member-chip">
          <div class="summary-member-avatar">${escHtml(((m.name[0]||'')+(m.surname[0]||'')).toUpperCase())}</div>
          <span>${escHtml(m.name)} ${escHtml(m.surname)}</span>
          <span class="badge badge-draft" style="margin-left:4px;">${escHtml(rl[m.role]||m.role)}</span>
        </div>`).join('');
    },

    async _createProject() {
      const name=document.getElementById('wiz-name').value.trim();
      const code=document.getElementById('wiz-code').value.trim().toUpperCase();
      const desc=document.getElementById('wiz-desc').value.trim();
      const start=document.getElementById('wiz-start').value;
      const end=document.getElementById('wiz-end').value;
      const budget=Number(document.getElementById('wiz-budget').value)||0;
      const currency=document.getElementById('wiz-currency').value;
      const nextBtn=document.getElementById('wiz-next-btn');
      if(nextBtn) { nextBtn.disabled=true; nextBtn.innerHTML='<span class="spinner"></span> Kaydediliyor…'; }
      try {
        // create_project_with_pm() creates the project AND makes the caller its PM row
        // in one atomic call — no more separate PM PIN. Use the caller's own name for
        // the PM's project_members row (falls back to email local-part).
        const authUser = AppState.authUser;
        const emailName = (authUser?.email || 'PM').split('@')[0];
        const pmName = authUser?.user_metadata?.full_name?.split(' ')?.[0] || emailName;
        const pmSurname = authUser?.user_metadata?.full_name?.split(' ')?.slice(1).join(' ') || '';
        const proj = await DS.createProjectWithPM(
          { name, code, description: desc, startDate: start, endDate: end,
            baselineStartDate: start, baselineEndDate: end, budget: { total: budget, currency, spent: 0 } },
          pmName, pmSurname
        );
        const createdIds = [];
        for (const m of this.pendingMembers) {
          const created = await DS.createMember(proj.id, { name: m.name, surname: m.surname, department: m.dept, role: m.role === 'pm' ? 'member' : m.role, email: m.email, capacity: m.capacity });
          if (created?.id) createdIds.push(created.id);
        }
        this.close();
        await renderDashboard();
        notifyProjectMembers(proj.id, createdIds);   // best-effort "you were added" email
        Toast.success(`"${escHtml(proj.name)}" projesi başarıyla oluşturuldu.`);
      } catch(e) {
        console.error('[Wizard._createProject]',e);
        Toast.error('Proje oluşturulamadı: '+e.message);
      } finally {
        if(nextBtn) { nextBtn.disabled=false; nextBtn.textContent='Projeyi Oluştur ✓'; }
      }
    },
  }; // end Wizard

  // Directory of registered users (profiles), used to auto-fill the add-member forms.
  // profiles is world-readable to authenticated users (profiles_select_all policy), so a
  // simple query is enough. Cached after first load.
  let _directory = null;
  async function loadDirectory() {
    if (_directory) return _directory;
    try {
      const res = await supabase.from('profiles').select('email, name, surname, department, full_name').order('name', { nullsFirst: false });
      _directory = (res.data || []).filter(p => p.email);
    } catch (e) { console.warn('[loadDirectory]', e); _directory = []; }
    return _directory;
  }

  // Fills a <select> with directory users; on pick, calls onPick(profile) to auto-fill fields.
  async function populateDirectorySelect(selectId, onPick) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const dir = await loadDirectory();
    sel.innerHTML = '<option value="">— Elle gir veya listeden seç —</option>' +
      dir.map((p, i) => {
        const label = ((p.name || p.surname) ? `${p.name || ''} ${p.surname || ''}`.trim() : (p.full_name || p.email));
        return `<option value="${i}">${escHtml(label)} — ${escHtml(p.email)}</option>`;
      }).join('');
    sel.onchange = () => {
      const p = dir[Number(sel.value)];
      if (p) onPick(p);
    };
  }

  // Fire-and-forget "you were added to project X" email via /api/notify.
  // SHELVED FOR NOW: transactional email (Gmail SMTP blocked from Vercel's serverless IPs,
  // SendGrid sender not yet verified). Auth confirmation emails still work via Supabase SMTP.
  // Flip NOTIFY_ENABLED to true once a working sender is configured (SendGrid verified sender
  // or corporate domain / Microsoft mail).
  const NOTIFY_ENABLED = false;
  function notifyProjectMembers(projectId, memberIds) {
    if (!NOTIFY_ENABLED) return;
    if (!projectId || !memberIds || !memberIds.length) return;
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, memberIds }),
    }).catch(err => console.warn('[notifyProjectMembers]', err));
  }

  // ================================================================
  // MEMBER MANAGEMENT (Step 1.5)
  // ================================================================
  function renderMembersView() {
    const pid=AppState.activeProjectId; if(!pid) return;
    const members=DS.listMembers(pid);
    const isPM=AppState.canEdit();
    const ROLE_LABELS={pm:'Proje Yöneticisi',member:'Ekip Üyesi',management:'Yönetim'};
    const tbody=document.getElementById('members-tbody');
    const addBtn=document.getElementById('btn-add-member-view');
    const subtitle=document.getElementById('members-subtitle');
    if(subtitle) subtitle.textContent=`${members.length} ekip üyesi`;
    if(addBtn) addBtn.style.display=isPM?'':'none';

    if(!tbody) return;
    if(!members.length){
      tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--color-text-muted);">
        ${isPM?'Henüz ekip üyesi yok. "Üye Ekle" butonuna tıklayın.':'Henüz ekip üyesi eklenmemiş.'}</td></tr>`;
      return;
    }
    tbody.innerHTML=members.map(m=>{
      const ini=((m.name[0]||'')+(m.surname[0]||'')).toUpperCase();
      const actions=isPM?`
        <button class="btn btn-ghost btn-icon btn-sm" data-edit-member="${escHtml(m.id)}" title="Düzenle">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" data-delete-member="${escHtml(m.id)}" title="Sil" style="color:var(--color-danger);opacity:.6;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>`:'';
      return `<tr>
        <td><div class="member-avatar">${escHtml(ini)}</div></td>
        <td><span style="font-weight:var(--font-weight-medium);">${escHtml(m.name)} ${escHtml(m.surname)}</span></td>
        <td>${escHtml(m.department||'—')}</td>
        <td><span class="badge badge-${m.role==='pm'?'active':m.role==='management'?'on-hold':'not-started'}">${escHtml(ROLE_LABELS[m.role]||m.role)}</span></td>
        <td>${m.capacity||8} saat</td>
        <td style="color:var(--color-text-muted);">${escHtml(m.email||'—')}</td>
        <td style="white-space:nowrap;">${actions}</td>
      </tr>`;
    }).join('');

    // Wire row buttons
    tbody.querySelectorAll('[data-edit-member]').forEach(btn=>{
      btn.addEventListener('click',()=>openMemberForm(btn.dataset.editMember));
    });
    tbody.querySelectorAll('[data-delete-member]').forEach(btn=>{
      btn.addEventListener('click',()=>deleteMember(btn.dataset.deleteMember));
    });
  }

  function openMemberForm(memberId=null) {
    const panel=document.getElementById('member-form-panel');
    const titleEl=document.getElementById('member-form-title');
    const editId=document.getElementById('mf-editing-id');
    if(!panel) return;
    panel.style.display='';
    // Clear
    ['mf-name','mf-surname','mf-dept','mf-email'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    const mfRole=document.getElementById('mf-role'); if(mfRole) mfRole.value='member';
    const mfCap=document.getElementById('mf-capacity'); if(mfCap) mfCap.value='8';
    const errEl=document.getElementById('err-mf'); if(errEl) errEl.textContent='';
    editId.value='';

    // Directory picker only makes sense when adding (not editing an existing row).
    const dirGroup=document.getElementById('mf-directory-group');
    const dirSel=document.getElementById('mf-directory');
    if(dirSel) dirSel.value='';
    if(memberId){
      const pid=AppState.activeProjectId;
      const m=DS.getMember(pid,memberId);
      if(m){
        titleEl.textContent='Üyeyi Düzenle';
        document.getElementById('mf-name').value=m.name||'';
        document.getElementById('mf-surname').value=m.surname||'';
        document.getElementById('mf-dept').value=m.department||'';
        document.getElementById('mf-email').value=m.email||'';
        if(mfRole) mfRole.value=m.role||'member';
        if(mfCap) mfCap.value=m.capacity||8;
        editId.value=memberId;
      }
      if(dirGroup) dirGroup.style.display='none';
    } else {
      titleEl.textContent='Yeni Üye Ekle';
      if(dirGroup) dirGroup.style.display='';
      populateDirectorySelect('mf-directory', (p) => {
        document.getElementById('mf-name').value = p.name || '';
        document.getElementById('mf-surname').value = p.surname || '';
        document.getElementById('mf-dept').value = p.department || '';
        document.getElementById('mf-email').value = p.email || '';
      });
    }
    document.getElementById('mf-name').focus();
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  async function saveMemberForm() {
    const pid=AppState.activeProjectId; if(!pid) return;
    const name=document.getElementById('mf-name').value.trim();
    const surname=document.getElementById('mf-surname').value.trim();
    const dept=document.getElementById('mf-dept').value.trim();
    const role=document.getElementById('mf-role').value;
    const cap=Number(document.getElementById('mf-capacity').value)||8;
    const email=document.getElementById('mf-email').value.trim();
    const editId=document.getElementById('mf-editing-id').value;
    const errEl=document.getElementById('err-mf');

    if(!name||!surname){ if(errEl) errEl.textContent='Ad ve soyad zorunludur.'; return; }
    if(!email){ if(errEl) errEl.textContent='E-posta zorunludur (davet bu adrese bağlanır).'; return; }
    if(errEl) errEl.textContent='';

    try {
      if(editId){
        await DS.updateMember(pid,editId,{name,surname,department:dept,role,capacity:cap,email});
        Toast.success('Ekip üyesi güncellendi.');
      } else {
        // No password/PIN needed: creates a project_members row with user_id=null,
        // linked automatically the first time that person logs in with a matching email
        // (handle_new_user trigger / claim_project_membership RPC).
        const created = await DS.createMember(pid,{name,surname,department:dept,role,capacity:cap,email});
        if (created?.id) notifyProjectMembers(pid, [created.id]);   // best-effort "you were added" email
        Toast.success(`${name} ${surname} eklendi.`);
      }
    } catch(err) { if(errEl) errEl.textContent = err.message; return; }
    document.getElementById('member-form-panel').style.display='none';
    renderMembersView();
  }

  async function deleteMember(memberId) {
    const pid=AppState.activeProjectId; if(!pid) return;
    const m=DS.getMember(pid,memberId); if(!m) return;
    if(!window.confirm(`"${m.name} ${m.surname}" ekip üyesini kaldırmak istediğinize emin misiniz?`)) return;
    try { await DS.deleteMember(pid,memberId); } catch(err) { Toast.error('Silinemedi: '+err.message); return; }
    renderMembersView();
    Toast.success('Ekip üyesi kaldırıldı.');
  }

  function wireMemberManagement() {
    document.getElementById('btn-add-member-view')?.addEventListener('click',()=>openMemberForm());
    document.getElementById('mf-save-btn')?.addEventListener('click',()=>saveMemberForm());
    document.getElementById('mf-cancel-btn')?.addEventListener('click',()=>{
      document.getElementById('member-form-panel').style.display='none';
    });
  }

  // ================================================================
  // PROJECT SETTINGS (Step 1.7)
  // ================================================================
  function renderSettingsView() {
    const pid=AppState.activeProjectId; if(!pid) return;
    const p=DS.getProject(pid); if(!p) return;
    const isPM=AppState.canEdit();
    const notice=document.getElementById('settings-pm-notice');
    if(notice) notice.style.display=isPM?'none':'';

    // Populate fields
    const fields=['set-name','set-code','set-desc','set-start','set-end','set-status','set-budget','set-currency'];
    const values={
      'set-name': p.name||'',
      'set-code': p.code||'',
      'set-desc': p.description||'',
      'set-start': p.startDate||'',
      'set-end': p.endDate||'',
      'set-status': p.status||'draft',
      'set-budget': p.budget?.total||'',
      'set-currency': p.budget?.currency||'TRY',
    };
    fields.forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.value=values[id]??'';
    });

    // Disable all if not PM
    ['set-name','set-desc','set-start','set-end','set-status','set-budget','set-currency'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.disabled=!isPM;
    });
    const saveBtn=document.getElementById('btn-save-settings');
    if(saveBtn) saveBtn.style.display=isPM?'':'none';
    const delBtn=document.getElementById('btn-delete-project-settings');
    if(delBtn) delBtn.style.display=isPM?'':'none';
    const errEl=document.getElementById('err-settings');
    if(errEl) errEl.textContent='';
  }

  async function saveProjectSettings() {
    const pid=AppState.activeProjectId; if(!pid) return;
    if(!AppState.canEdit()) { Toast.error('Bu işlem için PM yetkisi gereklidir.'); return; }
    const name=document.getElementById('set-name').value.trim();
    const desc=document.getElementById('set-desc').value.trim();
    const start=document.getElementById('set-start').value;
    const end=document.getElementById('set-end').value;
    const status=document.getElementById('set-status').value;
    const budget=Number(document.getElementById('set-budget').value)||0;
    const currency=document.getElementById('set-currency').value;
    const errEl=document.getElementById('err-settings');
    const endErrEl=document.getElementById('err-set-end');

    if(errEl) errEl.textContent='';
    if(endErrEl) endErrEl.textContent='';

    if(!name){ if(errEl) errEl.textContent='Proje adı zorunludur.'; return; }
    if(start&&end&&end<=start){ if(endErrEl) endErrEl.textContent='Bitiş tarihi başlangıçtan sonra olmalı.'; return; }

    try {
      await DS.updateProject(pid,{name,description:desc,startDate:start,endDate:end,status,
        budget:{...DS.getProject(pid).budget,total:budget,currency}});
    } catch(err) { if(errEl) errEl.textContent = err.message; return; }
    await AppState.setActiveProject(pid); // refresh sidebar project name + cache
    renderDashboard();
    Toast.success('Proje ayarları kaydedildi.');
  }

  function wireSettings() {
    document.getElementById('btn-save-settings')?.addEventListener('click',()=>saveProjectSettings());
    document.getElementById('btn-delete-project-settings')?.addEventListener('click',async()=>{
      const pid=AppState.activeProjectId; if(!pid) return;
      const p=DS.getProject(pid); if(!p) return;
      if(!window.confirm(`"${p.name}" projesini silmek istediğinize emin misiniz? Bu işlem GERİ ALINAMAZ.`)) return;
      try { await DS.deleteProject(pid); } catch(err) { Toast.error('Proje silinemedi: '+err.message); return; }
      await AppState.setActiveProject(null);
      AppState.setSession(null);
      Router.navigate('dashboard');
      Toast.success('Proje silindi.');
    });
  }

  // ================================================================
  // ACTIVITIES — Phase 2 (Steps 2.1, 2.2, 2.3)
  // ================================================================

  // ---- Constants ----
  const GROUP_COLORS=['#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777','#65A30D','#9333EA','#0284C7'];
  const STATUS_TR={not_started:'Başlamadı',in_progress:'Devam Ediyor',completed:'Tamamlandı',on_hold:'Beklemede',cancelled:'İptal'};
  const PRIORITY_TR={critical:'Kritik',high:'Yüksek',medium:'Orta',low:'Düşük'};

  // ---- Automatic WBS numbering ----
  // Walks the group tree in display order (root groups → their sub-groups then activities,
  // recursively) and assigns hierarchical WBS codes: group "1", its children "1.1"/"1.2",
  // a sub-group's children "1.2.1", etc. Ungrouped activities continue the root sequence.
  function computeWbsCodes(pid) {
    const groups = DS.listGroups(pid);
    const activities = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    const groupCodes = {};   // groupId -> code
    const activityCodes = {}; // activityId -> code
    const byOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999);

    function walk(group, prefix) {
      groupCodes[group.id] = prefix;
      let n = 0;
      // Sub-groups first (matches the render order), then this group's activities.
      groups.filter(g => g.parentId === group.id).sort(byOrder).forEach(sg => {
        n++; walk(sg, `${prefix}.${n}`);
      });
      activities.filter(a => a.groupId === group.id).sort(byOrder).forEach(a => {
        n++; activityCodes[a.id] = `${prefix}.${n}`;
      });
    }

    let root = 0;
    groups.filter(g => !g.parentId).sort(byOrder).forEach(g => { root++; walk(g, String(root)); });
    // Activities with no (existing) group continue the top-level numbering.
    activities.filter(a => !a.groupId || !groups.find(g => g.id === a.groupId)).sort(byOrder)
      .forEach(a => { root++; activityCodes[a.id] = String(root); });

    return { groupCodes, activityCodes };
  }

  // Recomputes WBS codes and persists only the rows whose code actually changed.
  // Rows the PM set manually (wbsManual) are left alone — unless force:true (the toolbar
  // button), which resets everything back to fully-automatic numbering.
  async function renumberWBS(pid, { silent = false, force = false } = {}) {
    if (!AppState.canEdit()) return;
    const { groupCodes, activityCodes } = computeWbsCodes(pid);
    const updates = [];
    DS.listGroups(pid).forEach(g => {
      if (g.wbsManual && !force) return;
      const patch = {};
      if (groupCodes[g.id] !== undefined && groupCodes[g.id] !== g.wbsCode) patch.wbsCode = groupCodes[g.id];
      if (force && g.wbsManual) patch.wbsManual = false;
      if (Object.keys(patch).length) updates.push(DS.updateGroup(pid, g.id, patch));
    });
    DS.listActivities(pid).forEach(a => {
      if (a.wbsManual && !force) return;
      const patch = {};
      if (activityCodes[a.id] !== undefined && activityCodes[a.id] !== a.wbsCode) patch.wbsCode = activityCodes[a.id];
      if (force && a.wbsManual) patch.wbsManual = false;
      if (Object.keys(patch).length) updates.push(DS.updateActivity(pid, a.id, patch));
    });
    if (!updates.length) { if (!silent) Toast.success('WBS kodları zaten güncel.'); return; }
    try {
      await Promise.all(updates);
      renderActivitiesView();
      if (!silent) Toast.success('WBS kodları yeniden numaralandırıldı.');
    } catch (e) {
      console.error('[renumberWBS]', e);
      if (!silent) Toast.error('WBS numaralandırma başarısız: ' + e.message);
    }
  }

  // ---- State ----
  let _actSelectedIds=new Set();
  let _groupCollapsed={};   // groupId → true/false
  let _detailActivityId=null;

  // ================================================================
  // RENDER — Activities View
  // ================================================================
  function renderActivitiesView() {
    const pid=AppState.activeProjectId; if(!pid) return;
    const isPM=AppState.canEdit();
    const groups=DS.listGroups(pid);
    const activities=DS.listActivities(pid);
    const members=DS.listMembers(pid);
    const tbody=document.getElementById('wbs-tbody');
    if(!tbody) return;

    // Toolbar PM buttons
    document.getElementById('btn-add-group')?.style.setProperty('display', isPM?'':'none');
    document.getElementById('btn-add-activity')?.style.setProperty('display', isPM?'':'none');
    document.getElementById('btn-auto-wbs')?.style.setProperty('display', isPM?'':'none');
    const title=document.getElementById('act-toolbar-title');
    if(title){ const p=DS.getProject(pid); title.textContent=p?p.name+' — Aktiviteler':'Aktiviteler'; }

    // Build WBS tree rows
    const rows=[];
    // Root-level groups first, then recurse
    function buildGroup(grp, depth) {
      const grpActs=activities.filter(a=>a.groupId===grp.id&&a.status!=='cancelled');
      const allActs=activities.filter(a=>a.groupId===grp.id);
      const collapsed=!!_groupCollapsed[grp.id];
      rows.push({type:'group', grp, depth, collapsed, actCount:grpActs.length});
      if(!collapsed){
        // Sub-groups
        groups.filter(g=>g.parentId===grp.id).sort((a,b)=>a.order-b.order).forEach(sg=>buildGroup(sg,depth+1));
        // Activities in this group
        allActs.sort((a,b)=>(a.order??9999)-(b.order??9999)||(a.wbsCode||'').localeCompare(b.wbsCode||'')).forEach(a=>{
          rows.push({type:'activity', act:a, depth:depth+1, members});
        });
      }
    }
    groups.filter(g=>!g.parentId).sort((a,b)=>a.order-b.order).forEach(g=>buildGroup(g,0));

    // Activities without a group
    const ungrouped=activities.filter(a=>!a.groupId||!groups.find(g=>g.id===a.groupId));
    ungrouped.sort((a,b)=>(a.order??9999)-(b.order??9999)||(a.wbsCode||'').localeCompare(b.wbsCode||'')).forEach(a=>{
      rows.push({type:'activity', act:a, depth:0, members});
    });

    if(!rows.length){
      tbody.innerHTML=`<tr><td colspan="10"><div class="wbs-empty">${isPM?'Henüz aktivite grubu veya aktivite yok.<br><br><strong>Grup Ekle</strong> ile başlayın.':'Henüz aktivite eklenmemiş.'}</div></td></tr>`;
      return;
    }

    tbody.innerHTML=rows.map(r=>{
      if(r.type==='group') return renderGroupRow(r);
      return renderActivityRow(r, isPM);
    }).join('');

    // Wire group toggle, edit, delete
    tbody.querySelectorAll('[data-toggle-group]').forEach(el=>{
      el.addEventListener('click',e=>{ e.stopPropagation(); toggleGroup(el.dataset.toggleGroup); });
    });
    tbody.querySelectorAll('[data-edit-group]').forEach(el=>{
      el.addEventListener('click',e=>{ e.stopPropagation(); openGroupModal(el.dataset.editGroup); });
    });
    tbody.querySelectorAll('[data-delete-group]').forEach(el=>{
      el.addEventListener('click',e=>{ e.stopPropagation(); deleteGroup(el.dataset.deleteGroup); });
    });
    // Wire activity row click → detail
    tbody.querySelectorAll('[data-open-activity]').forEach(el=>{
      el.addEventListener('click',()=>openActivityDetail(el.dataset.openActivity));
    });
    // Wire checkboxes
    tbody.querySelectorAll('.act-row-cb').forEach(cb=>{
      cb.addEventListener('change',()=>{
        if(cb.checked) _actSelectedIds.add(cb.dataset.actId);
        else _actSelectedIds.delete(cb.dataset.actId);
        updateBulkBar();
      });
    });
    // Restore selection state
    tbody.querySelectorAll('.act-row-cb').forEach(cb=>{
      if(_actSelectedIds.has(cb.dataset.actId)) cb.checked=true;
    });
    updateBulkBar();

    // Wire drag-and-drop (PM only)
    wireDnD(tbody, isPM);
  }

  function renderGroupRow(r) {
    const {grp, depth, collapsed, actCount}=r;
    const indent=depth*16;
    const isPM=AppState.canEdit();
    const pmActions=isPM?`
      <button class="btn btn-ghost btn-icon btn-sm" data-edit-group="${escHtml(grp.id)}" title="Düzenle" style="padding:3px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn btn-ghost btn-icon btn-sm" data-delete-group="${escHtml(grp.id)}" title="Sil" style="padding:3px;color:var(--color-danger);opacity:.7;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>`:'';
    const dndGroupAttrs=isPM?`draggable="true" data-dnd-type="group" data-dnd-id="${escHtml(grp.id)}" data-dnd-parent="${escHtml(grp.parentId||'')}"`:'' ;
    const groupHandle=isPM?`<span class="drag-handle" title="Sürükleyerek sırala" onclick="event.stopPropagation()"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></span>`:'' ;
    return `<tr class="wbs-group-row" ${dndGroupAttrs}>
      <td colspan="10">
        <div class="wbs-group-cell" data-toggle-group="${escHtml(grp.id)}" style="padding-left:${14+indent}px;">
          ${groupHandle}
          <svg class="wbs-chevron${collapsed?' collapsed':''}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="wbs-group-color-dot" style="background:${escHtml(grp.color||'#2563EB')};"></span>
          <span class="wbs-group-name">${escHtml(grp.name)}</span>
          ${grp.wbsCode?`<span class="wbs-group-code">${escHtml(grp.wbsCode)}</span>`:''}
          <span class="wbs-group-count">${actCount} aktivite</span>
          <div class="wbs-group-actions">${pmActions}</div>
        </div>
      </td>
    </tr>`;
  }

  function renderActivityRow(r, isPM) {
    const {act, depth, members}=r;
    const indent=depth*16+20;
    const assigneeChips=(act.assignees||[]).map(mid=>{
      const m=members.find(x=>x.id===mid);
      const ini=m?((m.name[0]||'')+(m.surname[0]||'')).toUpperCase():'?';
      const nm=m?`${m.name} ${m.surname}`:'?';
      return `<span class="assignee-chip" title="${escHtml(nm)}">${escHtml(ini)}</span>`;
    }).join('');
    const isDetail=act.id===_detailActivityId;
    // "Gecikmiş" is computed, independent of the manual status. Two cases:
    //  - still open and past its end date  → currently overdue
    //  - completed, but finished after the end date (completed_at > end_date) → was late,
    //    so the badge persists ("gecikti ama tamamlandı").
    const isOpenOverdue=act.status!=='completed'&&act.status!=='cancelled'&&act.endDate&&act.endDate<toISODate()&&(act.percentComplete||0)<100;
    const wasLateCompleted=act.status==='completed'&&act.completedAt&&act.endDate&&act.completedAt.slice(0,10)>act.endDate;
    const isOverdue=isOpenOverdue||wasLateCompleted;
    const overdueBadge=isOverdue?`<span class="act-status-badge" style="margin-left:4px;background:var(--color-danger-light);color:var(--color-danger);">Gecikmiş</span>`:'';
    // Progress bar colour follows the status, not the percentage: green when completed,
    // blue while in progress (whatever the %), neutral otherwise.
    const pctColor=act.status==='completed'?'var(--color-success)':act.status==='in_progress'?'var(--color-primary)':'var(--color-border-dark)';
    const canEdit=isPM||AppState.canUpdateOwnActivity(act.assignees);
    const dndActAttrs=isPM?`draggable="true" data-dnd-type="activity" data-dnd-id="${escHtml(act.id)}" data-dnd-group="${escHtml(act.groupId||'')}"`:'';
    const actHandle=isPM?`<span class="drag-handle" title="Sürükleyerek sırala" onclick="event.stopPropagation()"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></span>`:'' ;
    return `<tr class="wbs-act-row${_actSelectedIds.has(act.id)?' selected':''}${isDetail?' detail-open':''}" data-open-activity="${escHtml(act.id)}" ${dndActAttrs}>
      <td style="padding-left:14px;display:flex;align-items:center;gap:4px;">${actHandle}${canEdit?`<input type="checkbox" class="act-cb act-row-cb" data-act-id="${escHtml(act.id)}" onclick="event.stopPropagation();" ${_actSelectedIds.has(act.id)?'checked':''} />`:''}  </td>
      <td style="padding-left:${indent}px;">
        <div class="act-name-cell">
          ${act.milestoneFlag?'<span class="milestone-diamond" title="Milestone"></span>':''}
          <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-family:monospace;margin-right:4px;">${escHtml(act.wbsCode||'')}</span>
          <span style="${act.status==='cancelled'?'text-decoration:line-through;opacity:.6;':''}">${escHtml(act.name)}</span>
        </div>
      </td>
      <td><div class="assignee-chips">${assigneeChips||'<span style="color:var(--color-text-light);font-size:11px;">—</span>'}</div></td>
      <td style="white-space:nowrap;color:var(--color-text-muted);font-size:12px;">${act.startDate?fmtDate(act.startDate):'—'}</td>
      <td style="white-space:nowrap;color:var(--color-text-muted);font-size:12px;">${act.endDate?fmtDate(act.endDate):'—'}</td>
      <td style="text-align:center;font-size:12px;">${act.duration||'—'}</td>
      <td><span class="act-status-badge act-status-${act.status}">${STATUS_TR[act.status]||act.status}</span>${overdueBadge}</td>
      <td>
        <div class="act-pct-cell">
          <div class="act-pct-bar"><div class="act-pct-fill" style="width:${act.percentComplete||0}%;background:${pctColor};"></div></div>
          <span class="act-pct-txt">${act.percentComplete||0}%</span>
        </div>
      </td>
      <td style="font-size:12px;color:var(--color-text-muted);">${act.cost?.planned?fmtMoney(act.cost.planned):'—'}</td>
      <td></td>
    </tr>`;
  }

  function toggleGroup(gid) {
    _groupCollapsed[gid]=!_groupCollapsed[gid];
    renderActivitiesView();
  }

  function expandAllGroups()  { DS.listGroups(AppState.activeProjectId||'').forEach(g=>{ _groupCollapsed[g.id]=false; }); renderActivitiesView(); }
  function collapseAllGroups(){ DS.listGroups(AppState.activeProjectId||'').forEach(g=>{ _groupCollapsed[g.id]=true;  }); renderActivitiesView(); }

  // ================================================================
  // BULK ACTIONS
  // ================================================================
  function updateBulkBar() {
    const bar=document.getElementById('act-bulk-bar');
    const txt=document.getElementById('bulk-count-txt');
    const n=_actSelectedIds.size;
    if(bar) bar.classList.toggle('visible', n>0);
    if(txt) txt.textContent=`${n} aktivite seçili`;
    const selAll=document.getElementById('select-all-cb');
    if(selAll){
      const allIds=Array.from(document.querySelectorAll('.act-row-cb')).map(c=>c.dataset.actId);
      selAll.checked=allIds.length>0&&allIds.every(id=>_actSelectedIds.has(id));
      selAll.indeterminate=!selAll.checked&&_actSelectedIds.size>0;
    }
  }

  async function applyBulkStatus() {
    const pid=AppState.activeProjectId; if(!pid) return;
    const status=document.getElementById('bulk-status-select')?.value;
    if(!status||!_actSelectedIds.size) return;
    const ids=[..._actSelectedIds];
    for (const id of ids) { try { await DS.updateActivity(pid,id,{status}); } catch(err) { Toast.error(err.message); } }
    _actSelectedIds.clear();
    document.getElementById('bulk-status-select').value='';
    renderActivitiesView();
    Toast.success('Durum güncellendi.');
  }

  // ================================================================
  // GROUP MODAL (Step 2.1)
  // ================================================================
  function openGroupModal(groupId=null) {
    const pid=AppState.activeProjectId; if(!pid) return;
    const overlay=document.getElementById('group-modal-overlay');
    const title=document.getElementById('group-modal-title');
    const editId=document.getElementById('gm-editing-id');
    const nameEl=document.getElementById('gm-name');
    const parentEl=document.getElementById('gm-parent');
    const colorEl=document.getElementById('gm-color');
    const errEl=document.getElementById('err-gm-name');
    if(!overlay) return;

    // Clear
    if(nameEl) nameEl.value='';
    if(errEl) errEl.textContent='';
    editId.value='';

    // Populate parent options
    const groups=DS.listGroups(pid);
    parentEl.innerHTML='<option value="">— Kök seviye —</option>';
    groups.forEach(g=>{
      const o=document.createElement('option');
      o.value=g.id; o.textContent=`${g.wbsCode?g.wbsCode+' ':'' }${g.name}`;
      parentEl.appendChild(o);
    });

    // Color swatches
    const swatchRow=document.getElementById('gm-color-row');
    let selectedColor=GROUP_COLORS[0];
    function renderSwatches(sel){
      swatchRow.innerHTML=GROUP_COLORS.map(c=>`<div class="color-swatch${c===sel?' selected':''}" data-color="${c}" style="background:${c};" title="${c}"></div>`).join('');
      swatchRow.querySelectorAll('.color-swatch').forEach(sw=>{
        sw.addEventListener('click',()=>{ selectedColor=sw.dataset.color; colorEl.value=selectedColor; renderSwatches(selectedColor); });
      });
    }

    if(groupId){
      const g=DS.getGroup(pid,groupId);
      if(g){
        title.textContent='Grubu Düzenle';
        if(nameEl) nameEl.value=g.name||'';
        if(parentEl) parentEl.value=g.parentId||'';
        selectedColor=g.color||GROUP_COLORS[0];
        colorEl.value=selectedColor;
        editId.value=groupId;
      }
    } else {
      title.textContent='Yeni Grup Ekle';
      colorEl.value=GROUP_COLORS[groups.length%GROUP_COLORS.length];
      selectedColor=colorEl.value;
    }
    renderSwatches(selectedColor);
    overlay.classList.add('open');
    setTimeout(()=>nameEl?.focus(),80);
  }

  function closeGroupModal() { document.getElementById('group-modal-overlay')?.classList.remove('open'); }

  async function saveGroupModal() {
    const pid=AppState.activeProjectId; if(!pid) return;
    const name=document.getElementById('gm-name').value.trim();
    const parentId=document.getElementById('gm-parent').value||null;
    const color=document.getElementById('gm-color').value||GROUP_COLORS[0];
    const editId=document.getElementById('gm-editing-id').value;
    const errEl=document.getElementById('err-gm-name');
    if(!name){ if(errEl) errEl.textContent='Grup adı zorunludur.'; return; }
    if(errEl) errEl.textContent='';
    const order=DS.listGroups(pid).length;
    try {
      // WBS is fully automatic now — no manual code input.
      if(editId){
        await DS.updateGroup(pid,editId,{name,parentId,color});
        Toast.success('Grup güncellendi.');
      } else {
        await DS.createGroup(pid,{name,parentId,color,order});
        Toast.success(`"${name}" grubu eklendi.`);
      }
    } catch(e) {
      console.error('[saveGroupModal]',e);
      Toast.error('Grup kaydedilemedi: '+e.message);
      return;
    }
    closeGroupModal();
    renderActivitiesView();
    renumberWBS(pid, { silent: true });
  }

  async function deleteGroup(gid) {
    const pid=AppState.activeProjectId; if(!pid) return;
    const g=DS.getGroup(pid,gid); if(!g) return;
    const acts=DS.listActivities(pid).filter(a=>a.groupId===gid);
    const msg=acts.length
      ? `"${g.name}" grubu ve içindeki ${acts.length} aktivite silinecek. Devam etmek istiyor musunuz?`
      : `"${g.name}" grubunu silmek istiyor musunuz?`;
    if(!window.confirm(msg)) return;
    try {
      // Null out groupId on activities, then remove the group
      for(const a of acts) await DS.updateActivity(pid,a.id,{groupId:null});
      await DS.deleteGroup(pid,gid);
    } catch(e) {
      console.error('[deleteGroup]',e);
      Toast.error('Grup silinemedi: '+e.message);
      return;
    }
    renderActivitiesView();
    renumberWBS(pid, { silent: true });
    Toast.success('Grup silindi.');
  }

  // ================================================================
  // ACTIVITY DETAIL PANEL (Step 2.3)
  // ================================================================
  function openActivityDetail(activityId) {
    const pid=AppState.activeProjectId; if(!pid) return;
    const act=DS.getActivity(pid,activityId); if(!act) return;
    const isPM=AppState.canEdit();
    const canEdit=isPM||AppState.canUpdateOwnActivity(act.assignees);

    _detailActivityId=activityId;
    const pane=document.getElementById('act-detail-pane');
    pane.classList.add('open');

    // Header
    document.getElementById('dpane-title').textContent=act.name||'Aktivite Detayı';
    document.getElementById('dpane-subtitle').textContent=(act.wbsCode?act.wbsCode+' — ':'')+STATUS_TR[act.status];

    // Populate fields
    document.getElementById('dp-activity-id').value=activityId;
    document.getElementById('dp-name').value=act.name||'';
    // Show AI Öner button for PM (AI key now lives server-side, so PM role is the only gate)
    const aiSuggestBtn = document.getElementById('btn-ai-suggest-activity');
    if (aiSuggestBtn) {
      const showAI = AppState.canEdit();
      aiSuggestBtn.style.display = showAI ? '' : 'none';
      aiSuggestBtn.onclick = () => runActivitySuggest(activityId);
    }
    // Hide/reset suggest panel on each open
    const suggestPanel = document.getElementById('ai-suggest-panel');
    if (suggestPanel) suggestPanel.classList.remove('visible');
    document.getElementById('dp-desc').value=act.description||'';
    document.getElementById('dp-start').value=act.startDate||'';
    document.getElementById('dp-end').value=act.endDate||'';
    document.getElementById('dp-duration').value=act.duration||0;
    document.getElementById('dp-base-start').value=act.baselineStartDate||'';
    document.getElementById('dp-base-end').value=act.baselineEndDate||'';
    document.getElementById('dp-pct').value=act.percentComplete||0;
    document.getElementById('dp-pct-slider').value=act.percentComplete||0;
    document.getElementById('dp-pct-val').textContent=(act.percentComplete||0)+'%';
    document.getElementById('dp-status').value=act.status||'not_started';
    document.getElementById('dp-priority').value=act.priority||'medium';
    document.getElementById('dp-milestone').checked=!!act.milestoneFlag;
    document.getElementById('dp-cost-planned').value=act.cost?.planned||'';
    document.getElementById('dp-cost-actual').value=act.cost?.actual||'';
    document.getElementById('dp-notes').value=act.notes||'';
    document.getElementById('err-dp-name').textContent='';
    document.getElementById('err-dp-general').textContent='';

    // Group select
    const groupSel=document.getElementById('dp-group');
    const groups=DS.listGroups(pid);
    groupSel.innerHTML='<option value="">— Grup seçin —</option>'+groups.map(g=>`<option value="${escHtml(g.id)}" ${act.groupId===g.id?'selected':''}>${escHtml((g.wbsCode?g.wbsCode+' ':'')+g.name)}</option>`).join('');

    // Assignee multi-select
    const members=DS.listMembers(pid);
    const assigneeList=document.getElementById('dp-assignees-list');
    assigneeList.innerHTML=members.length?members.map(m=>{
      const checked=(act.assignees||[]).includes(m.id);
      const ini=((m.name[0]||'')+(m.surname[0]||'')).toUpperCase();
      return `<label class="assignee-option">
        <input type="checkbox" value="${escHtml(m.id)}" ${checked?'checked':''} ${!canEdit?'disabled':''} />
        <span class="assignee-chip" style="flex-shrink:0;">${escHtml(ini)}</span>
        <span>${escHtml(m.name+' '+m.surname)}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--color-text-muted);">${escHtml(m.role==='pm'?'PM':m.role==='management'?'Yönetim':'Üye')}</span>
      </label>`;
    }).join(''):'<div style="color:var(--color-text-muted);font-size:var(--font-size-xs);padding:4px;">Ekip üyesi yok.</div>';

    // Disable fields for non-editors
    const editFields=['dp-name','dp-desc','dp-start','dp-end','dp-duration','dp-base-start','dp-base-end','dp-notes','dp-cost-planned','dp-cost-actual','dp-group'];
    editFields.forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled=!canEdit; });
    const statusSel=document.getElementById('dp-status');
    if(statusSel) statusSel.disabled=!canEdit;
    const priorSel=document.getElementById('dp-priority');
    if(priorSel) priorSel.disabled=!isPM;
    const pctSlider=document.getElementById('dp-pct-slider');
    if(pctSlider) pctSlider.disabled=!canEdit;
    const pctNum=document.getElementById('dp-pct');
    if(pctNum) pctNum.disabled=!canEdit;
    const ms=document.getElementById('dp-milestone');
    if(ms) ms.disabled=!isPM;

    // Cancel activity button
    const cancelBtn=document.getElementById('btn-cancel-activity');
    if(cancelBtn) cancelBtn.style.display=(isPM&&act.status!=='cancelled')?'':'none';
    // Delete (hard) — PM only
    const deleteBtn=document.getElementById('btn-delete-activity');
    if(deleteBtn) deleteBtn.style.display=isPM?'':'none';
    const saveBtn=document.getElementById('btn-save-activity');
    if(saveBtn) saveBtn.style.display=canEdit?'':'none';

    // Highlight row
    document.querySelectorAll('.wbs-act-row').forEach(r=>r.classList.remove('detail-open'));
    document.querySelectorAll(`[data-open-activity="${CSS.escape(activityId)}"]`).forEach(r=>r.classList.add('detail-open'));

    // Render dependency list (Step 2.4)
    renderDepList(pid, activityId);
  }

  async function openNewActivity(groupId=null) {
    const pid=AppState.activeProjectId; if(!pid) return;
    if(!AppState.canEdit()){ Toast.error('Aktivite eklemek için PM yetkisi gereklidir.'); return; }

    // Create a blank activity
    const _newGid=groupId||DS.listGroups(pid)[0]?.id||null;
    const _newOrder=DS.listActivities(pid).filter(a=>a.groupId===_newGid&&a.status!=='cancelled').length;
    let act;
    try {
      act=await DS.createActivity(pid,{
        groupId: _newGid,
        name:'Yeni Aktivite', status:'not_started', priority:'medium',
        wbsCode:'', percentComplete:0, assignees:[], duration:0, order:_newOrder,
      });
    } catch(e) {
      console.error('[openNewActivity]',e);
      Toast.error('Aktivite oluşturulamadı: '+e.message);
      return;
    }
    renderActivitiesView();
    await renumberWBS(pid, { silent: true });
    openActivityDetail(act.id);
    // Focus name field after render
    setTimeout(()=>{ const el=document.getElementById('dp-name'); if(el){ el.select(); } }, 80);
    Toast.success('Yeni aktivite oluşturuldu. Detayları doldurun.');
  }

  async function saveActivityDetail() {
    const pid=AppState.activeProjectId; if(!pid) return;
    const actId=document.getElementById('dp-activity-id').value; if(!actId) return;
    const act=DS.getActivity(pid,actId); if(!act) return;
    const isPM=AppState.canEdit();
    const canEdit=isPM||AppState.canUpdateOwnActivity(act.assignees);
    if(!canEdit){ Toast.error('Bu aktiviteyi düzenleme yetkiniz yok.'); return; }

    const name=document.getElementById('dp-name').value.trim();
    const errEl=document.getElementById('err-dp-name');
    if(!name){ if(errEl) errEl.textContent='Aktivite adı zorunludur.'; return; }
    if(errEl) errEl.textContent='';

    const start=document.getElementById('dp-start').value;
    const end=document.getElementById('dp-end').value;
    const errG=document.getElementById('err-dp-general');
    if(start&&end&&end<start){ if(errG) errG.textContent='Bitiş tarihi başlangıçtan önce olamaz.'; return; }
    if(errG) errG.textContent='';

    // Compute duration from dates if both set
    let duration=Number(document.getElementById('dp-duration').value)||0;
    if(start&&end) duration=workingDaysBetween(start,end);

    const assignees=[...document.querySelectorAll('#dp-assignees-list input[type="checkbox"]:checked')].map(cb=>cb.value);
    const pct=Math.min(100,Math.max(0,Number(document.getElementById('dp-pct').value)||0));
    const updates={
      name,
      description: document.getElementById('dp-desc').value.trim(),
      groupId: document.getElementById('dp-group').value||null,
      startDate: start||null,
      endDate: end||null,
      baselineStartDate: document.getElementById('dp-base-start').value||null,
      baselineEndDate: document.getElementById('dp-base-end').value||null,
      duration,
      percentComplete: pct,
      status: document.getElementById('dp-status').value,
      priority: document.getElementById('dp-priority').value,
      milestoneFlag: document.getElementById('dp-milestone').checked,
      assignees,
      cost:{ planned:Number(document.getElementById('dp-cost-planned').value)||0, actual:Number(document.getElementById('dp-cost-actual').value)||0 },
      notes: document.getElementById('dp-notes').value.trim(),
    };
    try {
      await DS.updateActivity(pid,actId,updates);
    } catch(e) {
      console.error('[saveActivityDetail]',e);
      Toast.error('Aktivite kaydedilemedi: '+e.message);
      return;
    }
    document.getElementById('dpane-title').textContent=name;
    document.getElementById('dpane-subtitle').textContent=((DS.getActivity(pid,actId)?.wbsCode)?DS.getActivity(pid,actId).wbsCode+' — ':'')+STATUS_TR[updates.status];
    renderActivitiesView();
    // Group may have changed → keep WBS codes consistent with the hierarchy.
    renumberWBS(pid, { silent: true });
    Toast.success('Aktivite kaydedildi.');
  }

  async function cancelActivityFromDetail() {
    const pid=AppState.activeProjectId; if(!pid) return;
    const actId=document.getElementById('dp-activity-id').value; if(!actId) return;
    const act=DS.getActivity(pid,actId); if(!act) return;
    if(!window.confirm(`"${act.name}" aktivitesini iptal etmek istiyor musunuz? (Silinmez, iptal durumuna alınır.)`)) return;
    try {
      await DS.cancelActivity(pid,actId);
    } catch(e) {
      console.error('[cancelActivityFromDetail]',e);
      Toast.error('Aktivite iptal edilemedi: '+e.message);
      return;
    }
    renderActivitiesView();
    closeDetailPane();
    Toast.success('Aktivite iptal edildi.');
  }

  async function deleteActivityFromDetail() {
    const pid=AppState.activeProjectId; if(!pid) return;
    if(!AppState.canEdit()){ Toast.error('Aktivite silmek için PM yetkisi gereklidir.'); return; }
    const actId=document.getElementById('dp-activity-id').value; if(!actId) return;
    const act=DS.getActivity(pid,actId); if(!act) return;
    if(!window.confirm(`"${act.name}" aktivitesini kalıcı olarak silmek istiyor musunuz?\n\nBu işlem geri alınamaz.`)) return;
    try {
      await DS.deleteActivity(pid,actId);
    } catch(e) {
      console.error('[deleteActivityFromDetail]',e);
      Toast.error('Aktivite silinemedi: '+e.message);
      return;
    }
    closeDetailPane();
    renderActivitiesView();
    renumberWBS(pid, { silent: true });
    Toast.success('Aktivite silindi.');
  }

  function closeDetailPane() {
    const pane=document.getElementById('act-detail-pane');
    pane.classList.remove('open');
    _detailActivityId=null;
    document.querySelectorAll('.wbs-act-row').forEach(r=>r.classList.remove('detail-open'));
  }

  // ================================================================
  // ================================================================
  // DRAG-AND-DROP REORDERING — Step 2.10
  // ================================================================
  async function saveDnDOrder(pid) {
    // Reads current DOM order of group rows and activity rows, then persists
    // the resulting .order values to Supabase (one updateGroup/updateActivity
    // call per row whose order actually changed).
    const tbody = document.getElementById('wbs-tbody');
    if (!tbody) return;

    // --- Groups: collect root-level group order ---
    const rootGroupOrder = [];
    const subGroupOrder  = {};   // parentId → [id, ...]

    tbody.querySelectorAll('tr[data-dnd-type="group"]').forEach(tr => {
      const id     = tr.dataset.dndId;
      const parent = tr.dataset.dndParent || '';
      if (!parent) {
        rootGroupOrder.push(id);
      } else {
        if (!subGroupOrder[parent]) subGroupOrder[parent] = [];
        subGroupOrder[parent].push(id);
      }
    });

    const groups = DS.listGroups(pid);
    const groupUpdates = [];
    groups.forEach(g => {
      const list = g.parentId ? (subGroupOrder[g.parentId] || []) : rootGroupOrder;
      const idx  = list.indexOf(g.id);
      if (idx >= 0 && idx !== g.order) groupUpdates.push(DS.updateGroup(pid, g.id, { order: idx }));
    });

    // --- Activities: collect per-group activity order ---
    const actOrderByGroup = {};   // groupId → [id, ...]
    tbody.querySelectorAll('tr[data-dnd-type="activity"]').forEach(tr => {
      const id  = tr.dataset.dndId;
      const gid = tr.dataset.dndGroup || '';
      if (!actOrderByGroup[gid]) actOrderByGroup[gid] = [];
      actOrderByGroup[gid].push(id);
    });

    const acts = DS.listActivities(pid);
    const actUpdates = [];
    acts.forEach(a => {
      const list = actOrderByGroup[a.groupId] || [];
      const idx  = list.indexOf(a.id);
      if (idx >= 0 && idx !== a.order) actUpdates.push(DS.updateActivity(pid, a.id, { order: idx }));
    });

    try {
      await Promise.all([...groupUpdates, ...actUpdates]);
      // Order changed → WBS codes follow the new sequence.
      await renumberWBS(pid, { silent: true });
    } catch (err) {
      Toast.error(err?.message || 'Sıralama kaydedilemedi.');
    }
  }

  function wireDnD(tbody, isPM) {
    if (!isPM || !tbody) return;

    let dragSrc = null;   // the <tr> being dragged

    tbody.addEventListener('dragstart', e => {
      const tr = e.target.closest('tr[data-dnd-type]');
      if (!tr) return;
      dragSrc = tr;
      tr.classList.add('dnd-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tr.dataset.dndId);
    });

    tbody.addEventListener('dragend', e => {
      const tr = e.target.closest('tr[data-dnd-type]');
      if (tr) tr.classList.remove('dnd-dragging');
      tbody.querySelectorAll('.dnd-over-top,.dnd-over-bottom').forEach(el => {
        el.classList.remove('dnd-over-top','dnd-over-bottom');
      });
      dragSrc = null;
    });

    tbody.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const tr = e.target.closest('tr[data-dnd-type]');
      if (!tr || tr === dragSrc) return;
      // Only allow same type + same context (group↔group at same parentId, activity↔activity in same group)
      if (tr.dataset.dndType !== dragSrc?.dataset.dndType) return;
      if (tr.dataset.dndType === 'activity' && tr.dataset.dndGroup !== dragSrc?.dataset.dndGroup) return;
      if (tr.dataset.dndType === 'group' && tr.dataset.dndParent !== dragSrc?.dataset.dndParent) return;

      tbody.querySelectorAll('.dnd-over-top,.dnd-over-bottom').forEach(el => {
        el.classList.remove('dnd-over-top','dnd-over-bottom');
      });
      const rect = tr.getBoundingClientRect();
      const mid  = rect.top + rect.height / 2;
      tr.classList.add(e.clientY < mid ? 'dnd-over-top' : 'dnd-over-bottom');
    });

    tbody.addEventListener('dragleave', e => {
      const tr = e.target.closest('tr[data-dnd-type]');
      if (tr) { tr.classList.remove('dnd-over-top','dnd-over-bottom'); }
    });

    tbody.addEventListener('drop', e => {
      e.preventDefault();
      const target = e.target.closest('tr[data-dnd-type]');
      if (!target || !dragSrc || target === dragSrc) return;
      if (target.dataset.dndType !== dragSrc.dataset.dndType) return;
      if (target.dataset.dndType === 'activity' && target.dataset.dndGroup !== dragSrc.dataset.dndGroup) return;
      if (target.dataset.dndType === 'group' && target.dataset.dndParent !== dragSrc.dataset.dndParent) return;

      const rect   = target.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;

      // DOM reorder
      if (before) {
        tbody.insertBefore(dragSrc, target);
      } else {
        target.after(dragSrc);
      }

      target.classList.remove('dnd-over-top','dnd-over-bottom');

      // Persist
      const pid = AppState.activeProjectId;
      if (pid) saveDnDOrder(pid);
    });
  }

  // WIRE: Activities View
  // ================================================================
  function wireActivities() {
    // Expand/collapse all
    document.getElementById('btn-expand-all')?.addEventListener('click',expandAllGroups);
    document.getElementById('btn-collapse-all')?.addEventListener('click',collapseAllGroups);

    // Add group
    document.getElementById('btn-add-group')?.addEventListener('click',()=>openGroupModal());
    // Add activity
    document.getElementById('btn-add-activity')?.addEventListener('click',()=>openNewActivity());
    // Auto WBS renumber
    document.getElementById('btn-auto-wbs')?.addEventListener('click',()=>{
      const pid=AppState.activeProjectId; if(!pid) return;
      renumberWBS(pid,{force:true});
    });

    // Group modal
    document.getElementById('group-modal-close')?.addEventListener('click',closeGroupModal);
    document.getElementById('gm-cancel-btn')?.addEventListener('click',closeGroupModal);
    document.getElementById('gm-save-btn')?.addEventListener('click',saveGroupModal);
    document.getElementById('group-modal-overlay')?.addEventListener('click',e=>{ if(e.target.id==='group-modal-overlay') closeGroupModal(); });
    document.getElementById('gm-name')?.addEventListener('keydown',e=>{ if(e.key==='Enter') saveGroupModal(); });

    // Detail pane
    document.getElementById('btn-close-detail')?.addEventListener('click',closeDetailPane);
    document.getElementById('btn-close-detail-footer')?.addEventListener('click',closeDetailPane);
    document.getElementById('btn-save-activity')?.addEventListener('click',saveActivityDetail);
    document.getElementById('btn-cancel-activity')?.addEventListener('click',cancelActivityFromDetail);
    document.getElementById('btn-delete-activity')?.addEventListener('click',deleteActivityFromDetail);

    // Wire dependency add button
    document.getElementById('btn-dep-add')?.addEventListener('click',()=>{
      const pid=AppState.activeProjectId;
      const actId=document.getElementById('dp-activity-id')?.value;
      if(pid&&actId) addDependency(pid,actId);
    });

    // Percent slider ↔ number input sync
    const slider=document.getElementById('dp-pct-slider');
    const numInput=document.getElementById('dp-pct');
    const valLabel=document.getElementById('dp-pct-val');
    slider?.addEventListener('input',()=>{
      const v=slider.value;
      if(numInput) numInput.value=v;
      if(valLabel) valLabel.textContent=v+'%';
    });
    numInput?.addEventListener('input',()=>{
      const v=Math.min(100,Math.max(0,Number(numInput.value)||0));
      if(slider) slider.value=v;
      if(valLabel) valLabel.textContent=v+'%';
    });

    // AI suggest panel dismiss
    document.getElementById('btn-ai-suggest-dismiss')?.addEventListener('click', () => {
      document.getElementById('ai-suggest-panel')?.classList.remove('visible');
    });

    // Duration auto-calc from dates
    function recalcDuration(){
      const s=document.getElementById('dp-start')?.value;
      const e=document.getElementById('dp-end')?.value;
      const dur=document.getElementById('dp-duration');
      if(s&&e&&e>=s&&dur) dur.value=workingDaysBetween(s,e);
    }
    document.getElementById('dp-start')?.addEventListener('change',recalcDuration);
    document.getElementById('dp-end')?.addEventListener('change',recalcDuration);

    // Select-all checkbox
    document.getElementById('select-all-cb')?.addEventListener('change',e=>{
      const checked=e.target.checked;
      document.querySelectorAll('.act-row-cb').forEach(cb=>{
        cb.checked=checked;
        if(checked) _actSelectedIds.add(cb.dataset.actId);
        else _actSelectedIds.delete(cb.dataset.actId);
      });
      updateBulkBar();
    });

    // Bulk apply
    document.getElementById('btn-bulk-apply')?.addEventListener('click',applyBulkStatus);
    document.getElementById('btn-bulk-clear')?.addEventListener('click',()=>{
      _actSelectedIds.clear();
      document.querySelectorAll('.act-row-cb').forEach(cb=>cb.checked=false);
      updateBulkBar();
    });
  }


  // ================================================================
  // DEPENDENCIES — Step 2.4
  // ================================================================

  // Render current dependency list inside detail pane
  function renderDepList(pid, actId) {
    const act=DS.getActivity(pid,actId); if(!act) return;
    const deps=act.dependencies||[];
    const allActs=DS.listActivities(pid);
    const isPM=AppState.canEdit();
    const container=document.getElementById('dp-dep-list');
    if(!container) return;

    if(!deps.length){
      container.innerHTML='<div style="color:var(--color-text-muted);font-size:var(--font-size-xs);padding:4px 0 8px;">Bağımlılık tanımlanmamış.</div>';
    } else {
      container.innerHTML=deps.map((dep,i)=>{
        const pred=allActs.find(a=>a.id===dep.activityId);
        const lag=dep.lag||0;
        const lagTxt=lag===0?'':lag>0?`+${lag}g`:`${lag}g`;
        return `<div class="dep-row">
          <span class="dep-type-badge">${escHtml(dep.type||'FS')}</span>
          <span class="dep-name" title="${escHtml(pred?pred.name:'Silinmiş aktivite')}">${escHtml(pred?pred.name:'(Silinmiş)')}</span>
          ${lagTxt?`<span class="dep-lag">${escHtml(lagTxt)}</span>`:''}
          ${isPM?`<button class="btn btn-ghost btn-icon btn-sm dep-remove" data-dep-idx="${i}" title="Kaldır">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>`:''}
        </div>`;
      }).join('');
      // Wire remove buttons
      container.querySelectorAll('[data-dep-idx]').forEach(btn=>{
        btn.addEventListener('click',()=>removeDependency(pid,actId,Number(btn.dataset.depIdx)));
      });
    }

    // Populate predecessor select (exclude self and existing deps)
    const pred=document.getElementById('dp-dep-pred');
    if(!pred) return;
    const existingIds=new Set(deps.map(d=>d.activityId));
    existingIds.add(actId); // exclude self
    const eligible=allActs.filter(a=>!existingIds.has(a.id)&&a.status!=='cancelled');
    pred.innerHTML=eligible.length
      ? eligible.map(a=>`<option value="${escHtml(a.id)}">${escHtml((a.wbsCode?a.wbsCode+' ':'')+a.name)}</option>`).join('')
      : '<option value="">— Aktivite yok —</option>';

    // Show/hide add form based on PM role
    const addForm=document.getElementById('dp-dep-add-form');
    if(addForm) addForm.style.display=isPM?'':'none';
  }

  // DFS-based circular dependency check
  // Returns true if adding edge fromId→toId would create a cycle
  function hasCircularDep(activities, fromId, toId) {
    // Build adjacency: actId → [depIds it depends on]
    const adj={};
    activities.forEach(a=>{
      adj[a.id]=(a.dependencies||[]).map(d=>d.activityId);
    });
    // Temporarily add the new edge: toId's predecessors include fromId
    // We need to check: can we reach fromId starting from toId following existing deps?
    // (i.e., is fromId an ancestor of toId? if so, adding toId→fromId creates a cycle)
    // Actually: we're adding dep for actId=fromId with predecessor=toId
    // So fromId depends on toId. Cycle exists if toId already (transitively) depends on fromId.
    const visited=new Set();
    function dfs(nodeId){
      if(nodeId===fromId) return true; // found cycle
      if(visited.has(nodeId)) return false;
      visited.add(nodeId);
      return (adj[nodeId]||[]).some(predId=>dfs(predId));
    }
    return dfs(toId);
  }

  async function addDependency(pid, actId) {
    if(!AppState.canEdit()){ Toast.error('Bağımlılık eklemek için PM yetkisi gereklidir.'); return; }
    const predId=document.getElementById('dp-dep-pred')?.value;
    const type=document.getElementById('dp-dep-type')?.value||'FS';
    const lag=Number(document.getElementById('dp-dep-lag')?.value)||0;
    const errEl=document.getElementById('err-dep');

    const hide=()=>{ if(errEl){ errEl.style.display='none'; errEl.textContent=''; } };
    const show=(msg)=>{ if(errEl){ errEl.style.display='block'; errEl.textContent=msg; } };

    hide();
    if(!predId){ show('Önceki aktivite seçiniz.'); return; }

    const allActs=DS.listActivities(pid);
    // Circular dependency check
    if(hasCircularDep(allActs,actId,predId)){
      show(`⚠ Dairesel bağımlılık tespit edildi! Bu bağımlılık eklenemez — döngü oluşur.`);
      return;
    }

    const act=DS.getActivity(pid,actId); if(!act) return;
    const newDeps=[...(act.dependencies||[]),{activityId:predId,type,lag}];
    try {
      await DS.updateActivity(pid,actId,{dependencies:newDeps});
    } catch(e) {
      console.error('[addDependency]',e);
      show('Bağımlılık eklenemedi: '+e.message);
      return;
    }
    document.getElementById('dp-dep-lag').value='0';
    renderDepList(pid,actId);
    // Recompute CPM
    renderActivitiesView();
    Toast.success('Bağımlılık eklendi.');
  }

  async function removeDependency(pid, actId, idx) {
    const act=DS.getActivity(pid,actId); if(!act) return;
    const newDeps=(act.dependencies||[]).filter((_,i)=>i!==idx);
    try {
      await DS.updateActivity(pid,actId,{dependencies:newDeps});
    } catch(e) {
      console.error('[removeDependency]',e);
      Toast.error('Bağımlılık kaldırılamadı: '+e.message);
      return;
    }
    renderDepList(pid,actId);
    renderActivitiesView();
    Toast.success('Bağımlılık kaldırıldı.');
  }

  // ================================================================
  // CPM — Critical Path Method (Step 2.5)
  // ================================================================
  // Returns a Map: activityId → { ES, EF, LS, LF, float, critical }
  function computeCPM(activities) {
    const result=new Map();
    // Only non-cancelled activities participate
    const acts=activities.filter(a=>a.status!=='cancelled');
    if(!acts.length) return result;

    // Use duration (working days). If 0, treat as 1 for path calc.
    const dur=id=>{
      const a=acts.find(x=>x.id===id);
      return a?Math.max(1,Number(a.duration)||1):1;
    };

    // Build dependency map: id → [predecessorIds]
    const preds={};
    const succs={};
    acts.forEach(a=>{ preds[a.id]=[]; succs[a.id]=[]; });
    acts.forEach(a=>{
      (a.dependencies||[]).forEach(dep=>{
        if(preds[dep.activityId]!==undefined){
          preds[a.id].push({id:dep.activityId, lag:Number(dep.lag)||0, type:dep.type||'FS'});
          succs[dep.activityId].push(a.id);
        }
      });
    });

    // Topological sort (Kahn's algorithm)
    const inDeg={};
    acts.forEach(a=>{ inDeg[a.id]=(preds[a.id]||[]).length; });
    const queue=acts.filter(a=>inDeg[a.id]===0).map(a=>a.id);
    const topoOrder=[];
    while(queue.length){
      const n=queue.shift();
      topoOrder.push(n);
      (succs[n]||[]).forEach(sid=>{
        inDeg[sid]--;
        if(inDeg[sid]===0) queue.push(sid);
      });
    }
    // If topoOrder.length < acts.length there's a cycle — skip CPM gracefully
    if(topoOrder.length<acts.length){
      acts.forEach(a=>result.set(a.id,{ES:0,EF:dur(a.id),LS:0,LF:dur(a.id),float:0,critical:false}));
      return result;
    }

    // Forward pass: ES=0 for roots, EF=ES+dur
    const ES={}, EF={};
    topoOrder.forEach(id=>{
      const predList=preds[id]||[];
      if(!predList.length){
        ES[id]=0;
      } else {
        ES[id]=Math.max(...predList.map(p=>{
          const ef=EF[p.id]??0;
          // FS: ES = pred.EF + lag
          // SS: ES = pred.ES + lag
          // FF: EF is constrained later — simplified to FS for ES calc
          // SF: ES = pred.ES + dur(pred) + lag — treated as FS
          if(p.type==='SS') return (ES[p.id]??0)+p.lag;
          return ef+p.lag; // FS, FF, SF approximated
        }));
      }
      EF[id]=ES[id]+dur(id);
    });

    // Project end = max EF
    const projectEnd=Math.max(...Object.values(EF));

    // Backward pass: LF=projectEnd for sinks, LS=LF-dur
    const LS={}, LF={};
    [...topoOrder].reverse().forEach(id=>{
      const succList=succs[id]||[];
      if(!succList.length){
        LF[id]=projectEnd;
      } else {
        LF[id]=Math.min(...succList.map(sid=>{
          const pred=preds[sid].find(p=>p.id===id);
          const type=pred?.type||'FS';
          const lag=pred?.lag||0;
          if(type==='SS') return (LS[sid]??projectEnd)-lag;
          return (LS[sid]??projectEnd)-lag; // FS: LF[pred] = LS[succ] - lag
        }));
      }
      LS[id]=LF[id]-dur(id);
    });

    // Float and critical flag
    topoOrder.forEach(id=>{
      const f=Math.round((LS[id]??0)-(ES[id]??0));
      result.set(id,{
        ES:ES[id]??0, EF:EF[id]??0,
        LS:LS[id]??0, LF:LF[id]??0,
        float:f,
        critical:f<=0,
      });
    });
    return result;
  }

  // CPM cache — recomputed on each renderActivitiesView call
  let _cpmCache=new Map();

  // Patch renderActivityRow to use CPM data — store CPM on window for access
  // We extend renderActivitiesView to run CPM first and expose via closure
  const _origRenderActivitiesView=renderActivitiesView;
  renderActivitiesView=function() {
    const pid=AppState.activeProjectId;
    if(pid){
      const acts=DS.listActivities(pid);
      _cpmCache=computeCPM(acts);
      // Show/hide legend
      const legend=document.getElementById('cpm-legend');
      const hasCritical=[..._cpmCache.values()].some(v=>v.critical);
      const hasAnyCPM=_cpmCache.size>0;
      if(legend) legend.classList.toggle('hidden',!hasCritical||!hasAnyCPM);
    }
    _origRenderActivitiesView();
  };

  // Override renderActivityRow to inject CPM styling
  const _origRenderActivityRow=renderActivityRow;
  renderActivityRow=function(r, isPM) {
    const html=_origRenderActivityRow(r, isPM);
    const cpm=_cpmCache.get(r.act.id);
    if(!cpm||!cpm.critical) return html;
    // Add critical-path class and badge to the rendered row
    return html
      .replace('class="wbs-act-row','class="wbs-act-row critical-path')
      .replace('</span>\n      </td>', `</span><span class="cp-badge">CP</span>\n      </td>`);
  };

  // ================================================================
  // GANTT — Steps 2.6, 2.7, 2.8, 2.9
  // ================================================================

  // ---- Gantt state ----
  let _ganttScale = 'week';   // 'day' | 'week' | 'month'

  // ---- Layout constants ----
  const G = {
    ROW_H:     28,    // px per activity/group row
    HDR_H:     40,    // header height (date labels row)
    BAR_H:     16,    // bar height inside a row
    BAR_Y_OFF: 6,     // vertical offset from row top to bar top
    MIN_PX:    800,   // minimum SVG width
    PAD_L:     8,     // left pad inside timeline
    PAD_R:     40,    // right pad
  };

  // ---- Column widths per scale ----
  const SCALE_COL = { day: 24, week: 56, month: 80 };

  // ---- Scale helpers ----
  function ganttDateRange(activities) {
    const dates = activities.filter(a => a.startDate || a.endDate || a.baselineStartDate || a.baselineEndDate);
    if (!dates.length) return null;
    const all = [];
    dates.forEach(a => {
      if (a.startDate) all.push(new Date(a.startDate));
      if (a.endDate)   all.push(new Date(a.endDate));
      if (a.baselineStartDate) all.push(new Date(a.baselineStartDate));
      if (a.baselineEndDate)   all.push(new Date(a.baselineEndDate));
    });
    const minD = new Date(Math.min(...all));
    const maxD = new Date(Math.max(...all));
    // Add padding
    minD.setDate(minD.getDate() - 3);
    maxD.setDate(maxD.getDate() + 10);
    return { min: minD, max: maxD };
  }

  function startOfWeek(d) {
    const dt = new Date(d);
    const day = dt.getDay(); // 0=Sun
    dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); // Mon-based
    dt.setHours(0,0,0,0);
    return dt;
  }
  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  // Build array of column headers based on scale
  function buildColumns(minDate, maxDate, scale) {
    const cols = [];
    const colW = SCALE_COL[scale];
    if (scale === 'day') {
      const cur = new Date(minDate); cur.setHours(0,0,0,0);
      while (cur <= maxDate) {
        cols.push({ date: new Date(cur), label: cur.toLocaleDateString('tr-TR', {day:'2-digit',month:'short'}) });
        cur.setDate(cur.getDate() + 1);
      }
    } else if (scale === 'week') {
      let cur = startOfWeek(minDate);
      while (cur <= maxDate) {
        cols.push({ date: new Date(cur), label: cur.toLocaleDateString('tr-TR', {day:'2-digit',month:'short'}) });
        cur.setDate(cur.getDate() + 7);
      }
    } else { // month
      let cur = startOfMonth(minDate);
      while (cur <= maxDate) {
        cols.push({ date: new Date(cur), label: cur.toLocaleDateString('tr-TR', {month:'long',year:'numeric'}) });
        const nm = new Date(cur); nm.setMonth(nm.getMonth() + 1);
        cur = nm;
      }
    }
    return cols;
  }

  // Convert a date to X position in pixels
  function dateToX(date, minDate, cols, scale) {
    const colW = SCALE_COL[scale];
    if (!date) return null;
    const d = new Date(date); d.setHours(0,0,0,0);
    const minD = new Date(minDate); minD.setHours(0,0,0,0);
    const diffMs = d - minD;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (scale === 'day') return G.PAD_L + diffDays * colW;
    if (scale === 'week') return G.PAD_L + (diffDays / 7) * colW;
    // month: approximate by fraction of month
    const monthFrac = (d.getFullYear() - minD.getFullYear()) * 12 + (d.getMonth() - minD.getMonth())
      + (d.getDate() - 1) / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return G.PAD_L + monthFrac * colW;
  }

  // ================================================================
  // MAIN RENDER
  // ================================================================
  function renderGanttView() {
    const pid = AppState.activeProjectId; if (!pid) return;
    const proj = DS.getProject(pid); if (!proj) return;
    const allActs = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    const groups  = DS.listGroups(pid);

    const titleEl = document.getElementById('gantt-title');
    if (titleEl) titleEl.textContent = proj.name + ' — Gantt';

    // Mark active timescale button
    document.querySelectorAll('.timescale-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.scale === _ganttScale));

    const emptyEl = document.getElementById('gantt-empty');
    const svgWrap = document.getElementById('gantt-svg-wrap');
    const actsWithDates = allActs.filter(a => a.startDate && a.endDate);

    if (!actsWithDates.length) {
      if (emptyEl) emptyEl.style.display = '';
      if (svgWrap) svgWrap.style.display = 'none';
      document.getElementById('gantt-list-rows').innerHTML = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (svgWrap) svgWrap.style.display = '';

    // Run CPM for critical path
    const cpm = computeCPM(allActs);

    // Build ordered row list (groups + their activities)
    const rows = [];
    function addGroup(grp, depth) {
      rows.push({ type: 'group', grp, depth });
      groups.filter(g => g.parentId === grp.id).sort((a,b) => a.order - b.order)
            .forEach(sg => addGroup(sg, depth + 1));
      allActs.filter(a => a.groupId === grp.id)
             .sort((a,b) => (a.wbsCode||'').localeCompare(b.wbsCode||''))
             .forEach(a => rows.push({ type: 'act', act: a, depth: depth + 1, grp }));
    }
    groups.filter(g => !g.parentId).sort((a,b) => a.order - b.order).forEach(g => addGroup(g, 0));
    // Ungrouped activities
    allActs.filter(a => !a.groupId || !groups.find(g => g.id === a.groupId))
           .forEach(a => rows.push({ type: 'act', act: a, depth: 0, grp: null }));

    // Build columns
    const range = ganttDateRange(allActs);
    if (!range) return;
    const cols = buildColumns(range.min, range.max, _ganttScale);
    const colW = SCALE_COL[_ganttScale];
    const timeW = Math.max(G.MIN_PX, G.PAD_L + cols.length * colW + G.PAD_R);
    const totalH = G.HDR_H + rows.length * G.ROW_H;

    // ---- Render left list pane ----
    const listRows = document.getElementById('gantt-list-rows');
    if (listRows) {
      listRows.innerHTML = rows.map(r => {
        if (r.type === 'group') {
          const dot = `<span class="row-dot" style="background:${escHtml(r.grp.color||'#2563EB')};"></span>`;
          return `<div class="gantt-list-row group-row" style="height:${G.ROW_H}px;padding-left:${10+r.depth*12}px;">${dot}<span class="row-name">${escHtml(r.grp.name)}</span></div>`;
        }
        const isCp = cpm.get(r.act.id)?.critical;
        return `<div class="gantt-list-row act-row${isCp?' cp-row':''}" style="height:${G.ROW_H}px;padding-left:${10+r.depth*12}px;" data-goto-act="${escHtml(r.act.id)}">
          <span class="row-name" title="${escHtml(r.act.name)}">${escHtml(r.act.wbsCode?r.act.wbsCode+' ':'')}${escHtml(r.act.name)}</span>
        </div>`;
      }).join('');
      // Wire click → open activity detail
      listRows.querySelectorAll('[data-goto-act]').forEach(el => {
        el.addEventListener('click', () => {
          Router.navigate('activities');
          setTimeout(() => openActivityDetail(el.dataset.gotoAct), 150);
        });
      });
    }

    // ---- Build SVG ----
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('gantt-svg');
    svg.setAttribute('width', timeW);
    svg.setAttribute('height', totalH);
    svg.setAttribute('viewBox', `0 0 ${timeW} ${totalH}`);
    // Clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Helper: create SVG element
    const el = (tag, attrs, txt) => {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs||{}).forEach(([k,v]) => e.setAttribute(k,v));
      if (txt !== undefined) e.textContent = txt;
      return e;
    };

    // ---- Background & grid ----
    svg.appendChild(el('rect', { x:0, y:0, width:timeW, height:totalH, fill:'#fff' }));

    // Alternating row bands
    rows.forEach((r, i) => {
      const y = G.HDR_H + i * G.ROW_H;
      const fill = r.type === 'group' ? '#F9FAFB' : (i % 2 === 0 ? '#fff' : '#FAFAFA');
      svg.appendChild(el('rect', { x:0, y, width:timeW, height:G.ROW_H, fill }));
    });

    // Vertical column lines + header labels
    const hdrBg = el('rect', { x:0, y:0, width:timeW, height:G.HDR_H, fill:'#F3F4F6' });
    svg.appendChild(hdrBg);
    cols.forEach((col, ci) => {
      const x = G.PAD_L + ci * colW;
      // Grid line
      svg.appendChild(el('line', { x1:x, y1:G.HDR_H, x2:x, y2:totalH, stroke:'#E5E7EB', 'stroke-width':1 }));
      // Header label
      const lbl = el('text', { x: x + colW/2, y: G.HDR_H/2 + 5, 'text-anchor':'middle',
        'font-size':'10', fill:'#6B7280', 'font-family':'system-ui,sans-serif' }, col.label);
      svg.appendChild(lbl);
    });
    // Header bottom border
    svg.appendChild(el('line', { x1:0, y1:G.HDR_H, x2:timeW, y2:G.HDR_H, stroke:'#D1D5DB', 'stroke-width':1.5 }));

    // ---- Baseline bars (Step 2.8) ----
    rows.forEach((r, i) => {
      if (r.type !== 'act') return;
      const act = r.act;
      if (!act.baselineStartDate || !act.baselineEndDate) return;
      const bx = dateToX(act.baselineStartDate, range.min, cols, _ganttScale);
      const ex = dateToX(act.baselineEndDate,   range.min, cols, _ganttScale);
      if (bx === null || ex === null) return;
      const bw = Math.max(4, ex - bx);
      const y = G.HDR_H + i * G.ROW_H + G.BAR_Y_OFF + 2;
      svg.appendChild(el('rect', {
        x: bx, y, width: bw, height: G.BAR_H - 4,
        fill: 'none', stroke: '#9CA3AF', 'stroke-width': 1.5,
        'stroke-dasharray': '4 2', rx: 2,
      }));
    });

    // ---- Activity bars (Step 2.6) ----
    // Store bar centers for arrow drawing: actId → { x, y, w, cx, cy, ex, ey, sx, sy }
    const barInfo = {};
    rows.forEach((r, i) => {
      if (r.type !== 'act') return;
      const act = r.act;
      if (!act.startDate || !act.endDate) return;
      const bx = dateToX(act.startDate, range.min, cols, _ganttScale);
      const ex2 = dateToX(act.endDate,  range.min, cols, _ganttScale);
      if (bx === null || ex2 === null) return;
      const bw = Math.max(4, ex2 - bx);
      const by = G.HDR_H + i * G.ROW_H + G.BAR_Y_OFF;
      const color = r.grp?.color || '#2563EB';
      const isCp = cpm.get(act.id)?.critical;

      // Milestone diamond (Step 2.8)
      if (act.milestoneFlag) {
        const mx = bx + bw / 2, my = by + G.BAR_H / 2;
        const half = 9;
        const diamond = el('polygon', {
          points: `${mx},${my-half} ${mx+half},${my} ${mx},${my+half} ${mx-half},${my}`,
          fill: '#F59E0B', stroke: isCp ? '#DC2626' : '#D97706', 'stroke-width': isCp ? 2 : 1,
        });
        svg.appendChild(diamond);
        barInfo[act.id] = { x: bx, y: by, w: bw, sx: bx, sy: my, ex: bx+bw, ey: my, cx: mx, cy: my };
        return;
      }

      // Background bar
      svg.appendChild(el('rect', { x:bx, y:by, width:bw, height:G.BAR_H, fill:color+'22', rx:3 }));

      // % fill
      const pct = Math.min(100, act.percentComplete || 0) / 100;
      if (pct > 0) {
        svg.appendChild(el('rect', { x:bx, y:by, width:Math.max(0, bw*pct), height:G.BAR_H, fill:color+'CC', rx:3 }));
      }

      // Border — red for critical path
      svg.appendChild(el('rect', {
        x:bx, y:by, width:bw, height:G.BAR_H,
        fill:'none',
        stroke: isCp ? '#DC2626' : color,
        'stroke-width': isCp ? 2 : 1,
        rx: 3,
      }));

      // % label inside bar if wide enough
      if (bw > 32) {
        svg.appendChild(el('text', {
          x: bx + bw/2, y: by + G.BAR_H/2 + 4,
          'text-anchor':'middle', 'font-size':'9', fill:'#fff',
          'font-family':'system-ui,sans-serif', 'font-weight':'600',
        }, `${act.percentComplete||0}%`));
      }

      barInfo[act.id] = {
        x: bx, y: by, w: bw, h: G.BAR_H,
        sx: bx,      sy: by + G.BAR_H/2,  // start-mid
        ex: bx + bw, ey: by + G.BAR_H/2,  // end-mid
        cx: bx + bw/2, cy: by + G.BAR_H/2, // center
        tx: bx + bw,   ty: by,              // top-end
        bx2: bx,       by2: by + G.BAR_H,  // bottom-start
      };

      // Hover target (transparent rect)
      const name = act.name; const status = STATUS_TR[act.status]||act.status;
      const hov = el('rect', { x:bx, y:by, width:bw, height:G.BAR_H, fill:'transparent', rx:3, style:'cursor:pointer;' });
      const tooltip = document.getElementById('gantt-tooltip');
      hov.addEventListener('mousemove', e => {
        if (!tooltip) return;
        tooltip.innerHTML = `<strong>${escHtml(name)}</strong><br>${escHtml(status)} · ${act.percentComplete||0}%<br>${fmtDate(act.startDate)} – ${fmtDate(act.endDate)}`;
        tooltip.classList.add('visible');
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top  = (e.clientY - 8)  + 'px';
      });
      hov.addEventListener('mouseleave', () => tooltip?.classList.remove('visible'));
      hov.addEventListener('click', () => {
        Router.navigate('activities');
        setTimeout(() => openActivityDetail(act.id), 150);
      });
      svg.appendChild(hov);
    });

    // ---- Dependency arrows (Step 2.7) ----
    // Line styles per type
    const DEP_DASH = { FS:'', SS:'4 2', FF:'2 3', SF:'6 2 2 2' };
    const arrowSize = 5;

    rows.forEach((r) => {
      if (r.type !== 'act') return;
      const act = r.act;
      (act.dependencies || []).forEach(dep => {
        const from = barInfo[dep.activityId];
        const to   = barInfo[act.id];
        if (!from || !to) return;
        const type = dep.type || 'FS';
        const dash = DEP_DASH[type] || '';

        let x1, y1, x2, y2;
        // Connection points depend on dep type
        if (type === 'FS') { x1 = from.ex; y1 = from.ey; x2 = to.sx;  y2 = to.sy; }
        else if (type === 'SS') { x1 = from.sx; y1 = from.sy; x2 = to.sx;  y2 = to.sy; }
        else if (type === 'FF') { x1 = from.ex; y1 = from.ey; x2 = to.ex;  y2 = to.ey; }
        else /* SF */           { x1 = from.sx; y1 = from.sy; x2 = to.ex;  y2 = to.ey; }

        const midX = (x1 + x2) / 2;
        const pathD = `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`;
        const g = document.createElementNS(ns, 'g');
        g.appendChild(el('path', {
          d: pathD, fill:'none',
          stroke: '#6B7280', 'stroke-width': 1.5,
          'stroke-dasharray': dash,
          opacity: '0.75',
        }));
        // Arrowhead at end point
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const ax1 = x2 - arrowSize * Math.cos(angle - Math.PI/6);
        const ay1 = y2 - arrowSize * Math.sin(angle - Math.PI/6);
        const ax2 = x2 - arrowSize * Math.cos(angle + Math.PI/6);
        const ay2 = y2 - arrowSize * Math.sin(angle + Math.PI/6);
        g.appendChild(el('polygon', {
          points: `${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`,
          fill: '#6B7280', opacity: '0.75',
        }));
        svg.appendChild(g);
      });
    });

    // ---- Today line (Step 2.8) ----
    const todayX = dateToX(toISODate(), range.min, cols, _ganttScale);
    if (todayX !== null && todayX >= 0 && todayX <= timeW) {
      svg.appendChild(el('line', {
        x1: todayX, y1: 0, x2: todayX, y2: totalH,
        stroke: '#DC2626', 'stroke-width': 1.5, 'stroke-dasharray': '4 3', opacity: '0.8',
      }));
      svg.appendChild(el('text', {
        x: todayX + 3, y: G.HDR_H - 4,
        'font-size': '9', fill: '#DC2626', 'font-family': 'system-ui,sans-serif',
      }, 'Bugün'));
    }

    // Sync list pane scroll with timeline vertical scroll
    const listPane = document.getElementById('gantt-list-pane');
    const timePane = document.getElementById('gantt-timeline-pane');
    // Remove old listener to avoid stacking
    if (timePane._ganttScrollHandler) timePane.removeEventListener('scroll', timePane._ganttScrollHandler);
    timePane._ganttScrollHandler = () => { listPane.scrollTop = timePane.scrollTop; };
    timePane.addEventListener('scroll', timePane._ganttScrollHandler);
    if (listPane._ganttScrollHandler) listPane.removeEventListener('scroll', listPane._ganttScrollHandler);
    listPane._ganttScrollHandler = () => { timePane.scrollTop = listPane.scrollTop; };
    listPane.addEventListener('scroll', listPane._ganttScrollHandler);
  }

  // ================================================================
  // ================================================================
  // PHASE 3 — TRACKING & MONITORING (Steps 3.1–3.4)
  // ================================================================

  // ── Helpers ──────────────────────────────────────────────────
  function workingDaysFromToday(isoDate) {
    // Returns signed working days from today to isoDate (negative = past)
    const today = toISODate();
    if (isoDate >= today) return  workingDaysBetween(today, isoDate);
    return -workingDaysBetween(isoDate, today);
  }

  function getUpcomingActivities(pid) {
    const today = toISODate();
    return DS.listActivities(pid).filter(a => {
      if (a.status === 'cancelled' || a.status === 'completed') return false;
      if (!a.startDate) return false;
      const daysToStart = workingDaysBetween(today, a.startDate);
      return a.startDate >= today && daysToStart <= 7;
    });
  }

  // Compute spent cost per project from activity actual costs
  function computeSpentCost(pid) {
    return DS.listActivities(pid)
      .filter(a => a.status !== 'cancelled')
      .reduce((s, a) => s + (a.cost?.actual || 0), 0);
  }

  // ── 3.1 Summary Cards ────────────────────────────────────────
  function renderSummaryCards(pid, isMember) {
    const p          = DS.getProject(pid); if (!p) return;
    const progress   = DS.getProjectProgress(pid);
    const health     = DS.getProjectHealth(pid);
    const delayed    = DS.getDelayedActivities(pid);

    const healthMap = {
      healthy:  { emoji: '🟢', label: 'Sağlıklı',   cls: 'health-label-healthy' },
      caution:  { emoji: '🟡', label: 'Dikkat',      cls: 'health-label-caution' },
      critical: { emoji: '🔴', label: 'Kritik',      cls: 'health-label-critical' },
    };
    const h = healthMap[health] || healthMap.healthy;

    const cardsEl = document.getElementById('summary-cards');
    if (!cardsEl) return;

    let budgetCardsHtml = '';
    if (!isMember) {
      const spent      = computeSpentCost(pid);
      const budget     = p.budget?.total || 0;
      const currency   = p.budget?.currency || 'TRY';
      const costUsePct = budget > 0 ? Math.min(200, Math.round((spent / budget) * 100)) : 0;
      budgetCardsHtml = `
        <div class="summary-card">
          <div class="summary-card-label">Planlanan Bütçe</div>
          <div class="summary-card-value">${fmtMoney(budget, currency)}</div>
          <div class="summary-card-sub">${currency}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Gerçekleşen Maliyet</div>
          <div class="summary-card-value" style="color:${costUsePct>100?'var(--color-danger)':costUsePct>80?'var(--color-warning)':'var(--color-text)'};">${fmtMoney(spent, currency)}</div>
          <div class="summary-progress-bar"><div class="summary-progress-fill" style="width:${Math.min(100,costUsePct)}%;background:${costUsePct>100?'var(--color-danger)':costUsePct>80?'var(--color-warning)':'var(--color-success)'};"></div></div>
          <div class="summary-card-sub">Bütçenin %${costUsePct}'i kullanıldı</div>
        </div>
      `;
    }

    cardsEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-card-label">Genel İlerleme</div>
        <div class="summary-card-value">${progress}%</div>
        <div class="summary-progress-bar"><div class="summary-progress-fill" style="width:${progress}%;"></div></div>
        <div class="summary-card-sub">Ağırlıklı ortalama (süreye göre)</div>
      </div>
      <div class="summary-card health-card">
        <div class="summary-card-label">Proje Sağlığı</div>
        <div class="summary-card-value">
          <span class="health-emoji">${h.emoji}</span>
          <span class="${h.cls}">${h.label}</span>
        </div>
        <div class="summary-card-sub">${delayed.length} geciken aktivite</div>
      </div>
      ${budgetCardsHtml}
    `;

    // Status counts
    const acts = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    const today = toISODate();
    const counts = {
      completed:   acts.filter(a => a.status === 'completed').length,
      in_progress: acts.filter(a => a.status === 'in_progress').length,
      delayed:     acts.filter(a => a.status !== 'completed' && a.endDate && a.endDate < today && a.percentComplete < 100).length,
      not_started: acts.filter(a => a.status === 'not_started').length,
    };

    const gridEl = document.getElementById('status-count-grid');
    if (gridEl) gridEl.innerHTML = `
      <div class="status-count-item">
        <div class="status-count-dot" style="background:var(--status-completed);"></div>
        <div class="status-count-info"><div class="status-count-num">${counts.completed}</div><div class="status-count-lbl">Tamamlandı</div></div>
      </div>
      <div class="status-count-item">
        <div class="status-count-dot" style="background:var(--status-in-progress);"></div>
        <div class="status-count-info"><div class="status-count-num">${counts.in_progress}</div><div class="status-count-lbl">Devam Ediyor</div></div>
      </div>
      <div class="status-count-item">
        <div class="status-count-dot" style="background:var(--color-danger);"></div>
        <div class="status-count-info"><div class="status-count-num" style="color:${counts.delayed>0?'var(--color-danger)':'inherit'}">${counts.delayed}</div><div class="status-count-lbl">Gecikmiş</div></div>
      </div>
      <div class="status-count-item">
        <div class="status-count-dot" style="background:var(--status-not-started);"></div>
        <div class="status-count-info"><div class="status-count-num">${counts.not_started}</div><div class="status-count-lbl">Başlamadı</div></div>
      </div>
    `;
  }

  // ── 3.2 Delay & Risk ─────────────────────────────────────────
  function renderDelayRisk(pid) {
    const members  = DS.listMembers(pid);
    const today    = toISODate();

    function memberNames(assignees) {
      return (assignees || []).map(mid => {
        const m = members.find(x => x.id === mid);
        return m ? `${m.name} ${m.surname}` : '?';
      }).join(', ') || '—';
    }

    // Delayed
    const delayed = DS.getDelayedActivities(pid);
    const delayedBadge = document.getElementById('badge-delayed');
    if (delayedBadge) delayedBadge.textContent = delayed.length;
    const delayedTbody = document.getElementById('delayed-tbody');
    if (delayedTbody) {
      if (!delayed.length) {
        delayedTbody.innerHTML = `<tr><td colspan="5"><div class="tracking-empty">✅ Geciken aktivite bulunmuyor.</div></td></tr>`;
      } else {
        delayedTbody.innerHTML = delayed.map(a => {
          const overdueDays = workingDaysBetween(a.endDate, today);
          return `<tr>
            <td><strong>${escHtml(a.name)}</strong>${a.wbsCode?`<span style="margin-left:6px;font-size:11px;color:var(--color-text-muted);">${escHtml(a.wbsCode)}</span>`:''}</td>
            <td style="color:var(--color-text-muted);">${escHtml(memberNames(a.assignees))}</td>
            <td style="white-space:nowrap;">${fmtDate(a.endDate)}</td>
            <td><span class="overdue-badge">+${overdueDays} iş günü</span></td>
            <td><span class="act-status-badge act-status-${a.status}">${STATUS_TR[a.status]||a.status}</span></td>
          </tr>`;
        }).join('');
      }
    }

    // At-risk
    const atRisk = DS.getAtRiskActivities(pid);
    const atRiskBadge = document.getElementById('badge-atrisk');
    if (atRiskBadge) atRiskBadge.textContent = atRisk.length;
    const atRiskTbody = document.getElementById('atrisk-tbody');
    if (atRiskTbody) {
      if (!atRisk.length) {
        atRiskTbody.innerHTML = `<tr><td colspan="5"><div class="tracking-empty">✅ Risk altında aktivite bulunmuyor.</div></td></tr>`;
      } else {
        atRiskTbody.innerHTML = atRisk.map(a => {
          const remaining = workingDaysBetween(today, a.endDate);
          return `<tr>
            <td><strong>${escHtml(a.name)}</strong></td>
            <td style="color:var(--color-text-muted);">${escHtml(memberNames(a.assignees))}</td>
            <td style="white-space:nowrap;">${fmtDate(a.endDate)}</td>
            <td><span class="atrisk-badge">${remaining} iş günü</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:60px;height:5px;background:var(--color-border);border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:${a.percentComplete||0}%;background:var(--color-warning);border-radius:3px;"></div>
                </div>
                <span style="font-size:11px;">${a.percentComplete||0}%</span>
              </div>
            </td>
          </tr>`;
        }).join('');
      }
    }

    // Upcoming
    const upcoming = getUpcomingActivities(pid);
    const upcomingBadge = document.getElementById('badge-upcoming');
    if (upcomingBadge) upcomingBadge.textContent = upcoming.length;
    const upcomingTbody = document.getElementById('upcoming-tbody');
    if (upcomingTbody) {
      if (!upcoming.length) {
        upcomingTbody.innerHTML = `<tr><td colspan="5"><div class="tracking-empty">Yaklaşan 7 iş günü içinde başlayacak aktivite yok.</div></td></tr>`;
      } else {
        upcomingTbody.innerHTML = upcoming.map(a => `<tr>
          <td><strong>${escHtml(a.name)}</strong></td>
          <td style="color:var(--color-text-muted);">${escHtml(memberNames(a.assignees))}</td>
          <td style="white-space:nowrap;">${a.startDate ? fmtDate(a.startDate) : '—'}</td>
          <td style="white-space:nowrap;">${a.endDate   ? fmtDate(a.endDate)   : '—'}</td>
          <td><span class="act-status-badge act-status-${a.status}">${STATUS_TR[a.status]||a.status}</span></td>
        </tr>`).join('');
      }
    }
  }

  // ── 3.3 Cost Tracking ────────────────────────────────────────
  function renderCostTracking(pid) {
    const p        = DS.getProject(pid); if (!p) return;
    const acts     = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    const groups   = DS.listGroups(pid);
    const budget   = p.budget?.total   || 0;
    const currency = p.budget?.currency || 'TRY';

    const totalPlanned = acts.reduce((s, a) => s + (a.cost?.planned || 0), 0);
    const totalActual  = acts.reduce((s, a) => s + (a.cost?.actual  || 0), 0);
    const variance     = totalPlanned > 0 ? ((totalActual - totalPlanned) / totalPlanned) * 100 : 0;
    const budgetUsePct = budget > 0 ? Math.min(200, (totalActual / budget) * 100) : 0;

    // KPI row
    const kpiEl = document.getElementById('cost-kpi-row');
    if (kpiEl) kpiEl.innerHTML = `
      <div class="cost-kpi">
        <div class="cost-kpi-label">Toplam Planlanan</div>
        <div class="cost-kpi-value neutral">${fmtMoney(totalPlanned, currency)}</div>
      </div>
      <div class="cost-kpi">
        <div class="cost-kpi-label">Toplam Gerçekleşen</div>
        <div class="cost-kpi-value ${totalActual > totalPlanned ? 'negative' : 'positive'}">${fmtMoney(totalActual, currency)}</div>
      </div>
      <div class="cost-kpi">
        <div class="cost-kpi-label">Maliyet Sapması</div>
        <div class="cost-kpi-value ${variance > 0 ? 'negative' : 'positive'}">${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%</div>
      </div>
      <div class="cost-kpi">
        <div class="cost-kpi-label">Bütçe Kullanımı</div>
        <div class="cost-kpi-value ${budgetUsePct > 100 ? 'negative' : 'neutral'}">${budgetUsePct.toFixed(1)}%</div>
      </div>
    `;

    // Budget SVG bar chart
    const svgEl = document.getElementById('budget-svg');
    if (svgEl) {
      const W = svgEl.parentElement?.offsetWidth || 600;
      const maxVal = Math.max(budget, totalPlanned, totalActual, 1);
      const barH = 18; const gap = 10; const labelW = 120; const padR = 60;
      const chartW = W - labelW - padR;
      const bars = [
        { label: 'Bütçe',       value: budget,       color: '#93C5FD' },
        { label: 'Planlanan',   value: totalPlanned,  color: '#2563EB' },
        { label: 'Gerçekleşen', value: totalActual,   color: totalActual > budget ? '#DC2626' : '#16A34A' },
      ];
      const svgH = bars.length * (barH + gap) + gap;
      svgEl.setAttribute('height', svgH);
      svgEl.setAttribute('viewBox', `0 0 ${W} ${svgH}`);
      svgEl.innerHTML = bars.map((b, i) => {
        const y   = gap + i * (barH + gap);
        const bw  = Math.max(0, (b.value / maxVal) * chartW);
        const pct = budget > 0 ? ((b.value / budget) * 100).toFixed(0) : '—';
        return `
          <text x="${labelW - 6}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="12" fill="#6B7280">${escHtml(b.label)}</text>
          <rect x="${labelW}" y="${y}" width="${chartW}" height="${barH}" rx="3" fill="#F3F4F6"/>
          <rect x="${labelW}" y="${y}" width="${bw}" height="${barH}" rx="3" fill="${b.color}"/>
          <text x="${labelW + bw + 6}" y="${y + barH / 2 + 4}" font-size="11" fill="#6B7280">${fmtMoney(b.value, currency)}</text>
        `;
      }).join('');
    }

    // Group cost table
    const groupTbody = document.getElementById('cost-group-tbody');
    if (groupTbody) {
      if (!groups.length) {
        groupTbody.innerHTML = `<tr><td colspan="5"><div class="tracking-empty">Henüz aktivite grubu yok.</div></td></tr>`;
      } else {
        groupTbody.innerHTML = groups.map(g => {
          const gActs  = acts.filter(a => a.groupId === g.id);
          const gPlan  = gActs.reduce((s, a) => s + (a.cost?.planned || 0), 0);
          const gActual= gActs.reduce((s, a) => s + (a.cost?.actual  || 0), 0);
          const gVar   = gPlan > 0 ? ((gActual - gPlan) / gPlan) * 100 : 0;
          const usePct = gPlan > 0 ? Math.min(200, (gActual / gPlan) * 100) : 0;
          const barColor = usePct > 100 ? '#DC2626' : usePct > 80 ? '#D97706' : '#2563EB';
          return `<tr>
            <td>
              <div style="display:flex;align-items:center;gap:7px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${escHtml(g.color||'#2563EB')};flex-shrink:0;"></div>
                <span>${escHtml(g.name)}</span>
                ${g.wbsCode ? `<span style="font-size:11px;color:var(--color-text-muted);">${escHtml(g.wbsCode)}</span>` : ''}
              </div>
            </td>
            <td style="text-align:right;">${fmtMoney(gPlan, currency)}</td>
            <td style="text-align:right;">${fmtMoney(gActual, currency)}</td>
            <td class="${gVar > 0 ? 'cost-variance-neg' : 'cost-variance-pos'}" style="text-align:right;">
              ${gVar >= 0 ? '+' : ''}${gVar.toFixed(1)}%
            </td>
            <td>
              <div class="cost-bar-mini" style="min-width:80px;">
                <div class="cost-bar-mini-fill" style="width:${Math.min(100, usePct)}%;background:${barColor};"></div>
              </div>
              <span style="font-size:11px;color:var(--color-text-muted);">${usePct.toFixed(0)}%</span>
            </td>
          </tr>`;
        }).join('');
      }
    }
  }

  // ── 3.4 Workload & Capacity ───────────────────────────────────
  function renderWorkload(pid) {
    const members = DS.listMembers(pid);
    const acts    = DS.listActivities(pid).filter(a => a.status !== 'cancelled');

    // Per-member stats
    const stats = members.map(m => {
      const mActs      = acts.filter(a => (a.assignees||[]).includes(m.id));
      const totalDays  = mActs.reduce((s, a) => s + (a.duration || 0), 0);
      const capacity   = m.capacity || 8; // daily hours
      // Simple capacity usage: total working days assigned vs project duration in days
      // We estimate project span from activity dates
      const projectDays = (() => {
        const starts = acts.filter(a=>a.startDate).map(a=>a.startDate);
        const ends   = acts.filter(a=>a.endDate).map(a=>a.endDate);
        if (!starts.length || !ends.length) return 1;
        const earliest = starts.sort()[0];
        const latest   = ends.sort().reverse()[0];
        return Math.max(1, workingDaysBetween(earliest, latest));
      })();
      // Daily load = totalDays * 8hrs / projectDays / capacityHrs
      const dailyLoadPct = projectDays > 0 ? Math.round((totalDays * 8 / projectDays / capacity) * 100) : 0;
      return { m, mActs, totalDays, dailyLoadPct };
    });

    // Workload SVG bar chart
    const svgEl = document.getElementById('workload-svg');
    if (svgEl && stats.length) {
      const W = svgEl.parentElement?.offsetWidth || 600;
      const barH = 18; const gap = 10;
      const maxDays = Math.max(...stats.map(s => s.totalDays), 1);
      const labelW = 140; const padR = 60;
      const chartW = W - labelW - padR;
      const svgH = stats.length * (barH + gap) + gap;
      svgEl.setAttribute('height', svgH);
      svgEl.setAttribute('viewBox', `0 0 ${W} ${svgH}`);
      svgEl.innerHTML = stats.map((s, i) => {
        const y    = gap + i * (barH + gap);
        const bw   = Math.max(0, (s.totalDays / maxDays) * chartW);
        const name = `${s.m.name} ${s.m.surname}`;
        const color = s.dailyLoadPct > 100 ? '#DC2626' : '#2563EB';
        return `
          <text x="${labelW - 6}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="12" fill="#6B7280" clip-path="inset(0)">${escHtml(name.length>16 ? name.slice(0,15)+'…' : name)}</text>
          <rect x="${labelW}" y="${y}" width="${chartW}" height="${barH}" rx="3" fill="#F3F4F6"/>
          <rect x="${labelW}" y="${y}" width="${bw}" height="${barH}" rx="3" fill="${color}"/>
          <text x="${labelW + bw + 6}" y="${y + barH / 2 + 4}" font-size="11" fill="#6B7280">${s.totalDays} gün</text>
        `;
      }).join('');
    } else if (svgEl) {
      svgEl.setAttribute('height', '40');
      svgEl.innerHTML = `<text x="10" y="24" font-size="13" fill="#9CA3AF">Ekip üyesi bulunmuyor.</text>`;
    }

    // Member table
    const tbody = document.getElementById('workload-member-tbody');
    if (!tbody) return;
    if (!stats.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="tracking-empty">Ekip üyesi bulunmuyor.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = stats.map(s => {
      const isOver = s.dailyLoadPct > 100;
      const barColor = isOver ? 'over' : 'ok';
      const pctCapped = Math.min(100, s.dailyLoadPct);
      return `<tr>
        <td><strong>${escHtml(s.m.name)} ${escHtml(s.m.surname)}</strong></td>
        <td style="color:var(--color-text-muted);">${escHtml(s.m.department||'—')}</td>
        <td style="text-align:center;">${s.mActs.length}</td>
        <td style="text-align:center;">${s.totalDays} iş günü</td>
        <td>
          <div class="capacity-bar-wrap">
            <div class="capacity-bar">
              <div class="capacity-bar-fill ${barColor}" style="width:${pctCapped}%;"></div>
            </div>
            <span class="capacity-pct" style="color:${isOver?'var(--color-danger)':'var(--color-text-muted)'};">${s.dailyLoadPct}%</span>
          </div>
        </td>
        <td>${isOver
          ? `<span class="overload-warning"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Aşırı Yük</span>`
          : `<span style="color:var(--color-success);font-size:12px;">✓ Normal</span>`
        }</td>
      </tr>`;
    }).join('');
  }

  // ── Master render ─────────────────────────────────────────────
  function renderTrackingView() {
    const pid = AppState.activeProjectId; if (!pid) return;
    const p   = DS.getProject(pid);

    // Header
    const titleEl = document.getElementById('tracking-title');
    if (titleEl && p) titleEl.textContent = p.name + ' — İzleme';

    // Team members get a personalized "my tasks" breakdown instead of the
    // project-wide risk/cost/workload sections — no cost or capacity data,
    // no cross-team activity list, just their own assigned work.
    const isMember = AppState.session?.role === 'member';
    const toggleSection = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; };
    toggleSection('section-my-tasks', isMember);
    toggleSection('status-count-grid', !isMember);
    toggleSection('section-delayed', !isMember);
    toggleSection('section-atrisk', !isMember);
    toggleSection('section-upcoming', !isMember);
    toggleSection('section-cost', !isMember);
    toggleSection('section-workload', !isMember);

    renderSummaryCards(pid, isMember);
    if (isMember) {
      renderMyTasks(pid);
    } else {
      renderDelayRisk(pid);
      renderCostTracking(pid);
      renderWorkload(pid);
    }
  }

  // Member-only: their own assigned activities, split into the three buckets
  // that matter for day-to-day work — no cost, no teammates' tasks.
  function renderMyTasks(pid) {
    const mid = AppState.session?.memberId;
    const today = toISODate();
    const myActs = DS.listActivities(pid).filter(a => a.status !== 'cancelled' && (a.assignees || []).includes(mid));

    const delayed = myActs.filter(a => a.status !== 'completed' && a.endDate && a.endDate < today);
    const inProgress = myActs.filter(a => a.status === 'in_progress' && !(a.endDate && a.endDate < today));
    const notStarted = myActs.filter(a => a.status === 'not_started');

    const delayedTbody = document.getElementById('my-delayed-tbody');
    if (delayedTbody) {
      delayedTbody.innerHTML = delayed.length ? delayed.map(a => {
        const overdueDays = workingDaysBetween(a.endDate, today);
        return `<tr>
          <td><strong>${escHtml(a.name)}</strong>${a.wbsCode ? `<span style="margin-left:6px;font-size:11px;color:var(--color-text-muted);">${escHtml(a.wbsCode)}</span>` : ''}</td>
          <td style="white-space:nowrap;">${fmtDate(a.endDate)}</td>
          <td><span class="overdue-badge">+${overdueDays} iş günü</span></td>
          <td><span class="act-status-badge act-status-${a.status}">${STATUS_TR[a.status] || a.status}</span></td>
        </tr>`;
      }).join('') : `<tr><td colspan="4"><div class="tracking-empty">✅ Geciken göreviniz yok.</div></td></tr>`;
    }

    const inProgressTbody = document.getElementById('my-inprogress-tbody');
    if (inProgressTbody) {
      inProgressTbody.innerHTML = inProgress.length ? inProgress.map(a => `<tr>
        <td><strong>${escHtml(a.name)}</strong></td>
        <td style="white-space:nowrap;">${a.startDate ? fmtDate(a.startDate) : '—'}</td>
        <td style="white-space:nowrap;">${a.endDate ? fmtDate(a.endDate) : '—'}</td>
        <td>${a.percentComplete || 0}%</td>
      </tr>`).join('') : `<tr><td colspan="4"><div class="tracking-empty">Devam eden göreviniz yok.</div></td></tr>`;
    }

    const notStartedTbody = document.getElementById('my-notstarted-tbody');
    if (notStartedTbody) {
      notStartedTbody.innerHTML = notStarted.length ? notStarted.map(a => `<tr>
        <td><strong>${escHtml(a.name)}</strong></td>
        <td style="white-space:nowrap;">${a.startDate ? fmtDate(a.startDate) : '—'}</td>
        <td style="white-space:nowrap;">${a.endDate ? fmtDate(a.endDate) : '—'}</td>
      </tr>`).join('') : `<tr><td colspan="3"><div class="tracking-empty">Başlamamış göreviniz yok.</div></td></tr>`;
    }
  }

  // ================================================================
  // PHASE 4 — MEETINGS & ACTIONS (Steps 4.1–4.4)
  // ================================================================

  const MEETING_STATUS_TR = { planned:'Planlandı', completed:'Tamamlandı', cancelled:'İptal Edildi' };
  const ACTION_STATUS_TR  = { open:'Açık', in_progress:'Devam Ediyor', completed:'Tamamlandı', cancelled:'İptal Edildi', overdue:'Gecikmiş' };
  const ACTION_PRIORITY_TR= { high:'Yüksek', medium:'Orta', low:'Düşük' };

  // ── State ─────────────────────────────────────────────────────
  let _meetingModalAgenda   = [];   // local agenda array while editing
  let _meetingModalAttendees= [];   // local attendee id array while editing
  let _actionFilter         = 'all';

  // ── Helpers ───────────────────────────────────────────────────
  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('tr-TR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch { return iso; }
  }

  function countOpenActions(pid, meetingId) {
    return DS.listActions(pid).filter(a =>
      a.meetingId === meetingId && a.status !== 'completed' && a.status !== 'cancelled'
    ).length;
  }

  // ── 4.1 Meeting List ─────────────────────────────────────────
  async function renderMeetingsView() {
    const pid = AppState.activeProjectId; if (!pid) return;
    const isPM = AppState.canEdit();
    await DS.syncOverdueActions(pid);

    const p = DS.getProject(pid);
    const titleEl = document.getElementById('meetings-toolbar-title');
    if (titleEl && p) titleEl.textContent = p.name + ' — Toplantılar';

    const btnNew = document.getElementById('btn-new-meeting');
    if (btnNew) btnNew.style.display = isPM ? '' : 'none';

    const meetings = DS.listMeetings(pid).sort((a, b) => (b.date||'').localeCompare(a.date||''));
    const grid = document.getElementById('meeting-grid');
    if (!grid) return;

    if (!meetings.length) {
      grid.innerHTML = `<div class="p4-empty" style="grid-column:1/-1;">
        <div class="p4-empty-icon">📅</div>
        <h3>Henüz toplantı yok</h3>
        <p>${isPM ? '"Yeni Toplantı" ile ilk toplantıyı oluşturun.' : 'Henüz toplantı planlanmamış.'}</p>
      </div>`;
      return;
    }

    grid.innerHTML = meetings.map(m => {
      const openCount = countOpenActions(pid, m.id);
      return `<div class="meeting-card" data-open-meeting="${escHtml(m.id)}">
        <div class="meeting-card-header">
          <div class="meeting-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="meeting-card-info">
            <div class="meeting-card-title" title="${escHtml(m.title)}">${escHtml(m.title)}</div>
            <div class="meeting-card-date">${fmtDateTime(m.date)}${m.location ? ' · ' + escHtml(m.location) : ''}</div>
          </div>
          <span class="meeting-status-badge meeting-status-${m.status}">${MEETING_STATUS_TR[m.status]||m.status}</span>
        </div>
        <div class="meeting-card-meta">
          <span class="meeting-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${(m.attendees||[]).length} katılımcı
          </span>
          <span class="meeting-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            ${(m.agenda||[]).length} gündem maddesi
          </span>
          ${openCount > 0 ? `<span class="meeting-meta-item" style="color:var(--color-warning);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${openCount} açık aksiyon
          </span>` : ''}
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-open-meeting]').forEach(el => {
      el.addEventListener('click', () => openMeetingModal(el.dataset.openMeeting));
    });
  }

  // ── 4.1+4.2 Meeting Modal ─────────────────────────────────────
  function openMeetingModal(meetingId = null) {
    const pid = AppState.activeProjectId; if (!pid) return;
    if (!AppState.canEdit()) { Toast.error('Toplantı düzenlemek için PM yetkisi gereklidir.'); return; }

    const members = DS.listMembers(pid);
    const activities = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    const isNew = !meetingId;
    const m = meetingId ? DS.getMeeting(pid, meetingId) : null;

    // Populate member selects
    const memberOpts = members.map(mb => `<option value="${escHtml(mb.id)}">${escHtml(mb.name+' '+mb.surname)}</option>`).join('');
    const attendeeSel = document.getElementById('mm-attendee-select');
    if (attendeeSel) attendeeSel.innerHTML = '<option value="">— Üye seçin —</option>' + memberOpts;
    const presenterSel = document.getElementById('mm-agenda-presenter');
    if (presenterSel) presenterSel.innerHTML = '<option value="">— Sunan —</option>' + memberOpts;

    // Fill form
    document.getElementById('mm-meeting-id').value = meetingId || '';
    document.getElementById('mm-title').value    = m?.title    || '';
    document.getElementById('mm-location').value = m?.location || '';
    document.getElementById('mm-status').value   = m?.status   || 'planned';
    document.getElementById('mm-notes').value    = m?.notes    || '';

    // Date
    const dateVal = m?.date ? m.date.slice(0, 16) : new Date().toISOString().slice(0, 16);
    document.getElementById('mm-date').value = dateVal;

    // Attendees
    _meetingModalAttendees = [...(m?.attendees || [])];
    renderMeetingAttendees(members);

    // Agenda
    _meetingModalAgenda = (m?.agenda || []).map(a => ({ ...a }));
    renderMeetingAgenda(members);

    // Actions linked to this meeting
    const actionsContainer = document.getElementById('mm-actions-list');
    const btnAddAction = document.getElementById('btn-mm-add-action');
    if (!isNew && actionsContainer) {
      const mActions = DS.listActions(pid).filter(a => a.meetingId === meetingId);
      if (!mActions.length) {
        actionsContainer.innerHTML = '<span style="color:var(--color-text-muted);font-size:13px;">Bu toplantıya bağlı aksiyon yok.</span>';
      } else {
        actionsContainer.innerHTML = mActions.map(a => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-border);">
            <span class="action-status-badge action-status-${a.status}">${ACTION_STATUS_TR[a.status]||a.status}</span>
            <span style="flex:1;font-size:13px;">${escHtml(a.title)}</span>
            <span style="font-size:11px;color:var(--color-text-muted);">${a.dueDate ? fmtDate(a.dueDate) : '—'}</span>
          </div>`).join('');
      }
      if (btnAddAction) { btnAddAction.style.display = ''; btnAddAction.onclick = () => openActionModal(null, meetingId); }

      // Show AI summarize section for completed meetings (or any existing meeting)
      const aiSumWrap = document.getElementById('mm-ai-summarize-wrap');
      const btnAISummarize = document.getElementById('btn-mm-ai-summarize');
      if (aiSumWrap) {
        const isCompleted = (m?.status === 'completed');
        aiSumWrap.style.display = AppState.canEdit() ? '' : 'none';
        // Reset result area
        document.getElementById('mm-ai-summarize-result').innerHTML = '';
        document.getElementById('mm-ai-proposals').innerHTML = '';
        if (btnAISummarize) {
          btnAISummarize.onclick = () => runMeetingSummary(meetingId);
        }
      }
    } else if (actionsContainer) {
      actionsContainer.innerHTML = '<span style="font-size:13px;color:var(--color-text-muted);">Kaydedildikten sonra aksiyon ekleyebilirsiniz.</span>';
      if (btnAddAction) btnAddAction.style.display = 'none';
    }

    // Modal meta
    document.getElementById('meeting-modal-title').textContent = isNew ? 'Yeni Toplantı' : 'Toplantıyı Düzenle';
    const delBtn = document.getElementById('mm-delete-btn');
    if (delBtn) { delBtn.style.display = isNew ? 'none' : ''; delBtn.onclick = () => deleteMeeting(meetingId); }

    // Reset to first tab
    document.querySelectorAll('.meeting-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.meeting-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.meeting-tab[data-tab="mm-tab-details"]')?.classList.add('active');
    document.getElementById('mm-tab-details')?.classList.add('active');

    document.getElementById('meeting-modal-overlay')?.classList.add('open');
  }

  function closeMeetingModal() {
    document.getElementById('meeting-modal-overlay')?.classList.remove('open');
  }

  function renderMeetingAttendees(members) {
    const container = document.getElementById('mm-attendee-tags');
    if (!container) return;
    container.innerHTML = _meetingModalAttendees.map(id => {
      const mb = members.find(x => x.id === id);
      const name = mb ? `${mb.name} ${mb.surname}` : id;
      return `<span class="attendee-tag">${escHtml(name)}<button type="button" data-remove-attendee="${escHtml(id)}">×</button></span>`;
    }).join('');
    container.querySelectorAll('[data-remove-attendee]').forEach(btn => {
      btn.addEventListener('click', () => {
        _meetingModalAttendees = _meetingModalAttendees.filter(id => id !== btn.dataset.removeAttendee);
        const pid = AppState.activeProjectId;
        renderMeetingAttendees(DS.listMembers(pid || ''));
      });
    });
  }

  function renderMeetingAgenda(members) {
    const list = document.getElementById('mm-agenda-list');
    if (!list) return;
    if (!_meetingModalAgenda.length) {
      list.innerHTML = '<div style="color:var(--color-text-muted);font-size:13px;padding:8px 0;">Henüz gündem maddesi eklenmedi.</div>';
      return;
    }
    list.innerHTML = _meetingModalAgenda.map((item, i) => {
      const presenter = item.presenter ? members.find(m => m.id === item.presenter) : null;
      const presName  = presenter ? `${presenter.name} ${presenter.surname}` : '';
      return `<div class="agenda-item" data-agenda-idx="${i}">
        <span class="agenda-item-num">${i+1}</span>
        <span class="agenda-item-topic">${escHtml(item.topic||'')}</span>
        <span class="agenda-item-dur">${item.duration ? item.duration+'dk' : ''}</span>
        <span class="agenda-item-presenter">${escHtml(presName)}</span>
        <div class="agenda-item-actions">
          ${i > 0 ? `<button type="button" class="btn btn-ghost btn-icon btn-sm" data-agenda-up="${i}" title="Yukarı"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg></button>` : '<span style="width:24px;"></span>'}
          ${i < _meetingModalAgenda.length-1 ? `<button type="button" class="btn btn-ghost btn-icon btn-sm" data-agenda-down="${i}" title="Aşağı"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></button>` : '<span style="width:24px;"></span>'}
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-agenda-del="${i}" style="color:var(--color-danger);" title="Sil"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('[data-agenda-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.agendaUp);
        [_meetingModalAgenda[i-1], _meetingModalAgenda[i]] = [_meetingModalAgenda[i], _meetingModalAgenda[i-1]];
        renderMeetingAgenda(DS.listMembers(AppState.activeProjectId||''));
      });
    });
    list.querySelectorAll('[data-agenda-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.agendaDown);
        [_meetingModalAgenda[i], _meetingModalAgenda[i+1]] = [_meetingModalAgenda[i+1], _meetingModalAgenda[i]];
        renderMeetingAgenda(DS.listMembers(AppState.activeProjectId||''));
      });
    });
    list.querySelectorAll('[data-agenda-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        _meetingModalAgenda.splice(Number(btn.dataset.agendaDel), 1);
        renderMeetingAgenda(DS.listMembers(AppState.activeProjectId||''));
      });
    });
  }

  async function saveMeetingModal() {
    const pid = AppState.activeProjectId; if (!pid) return;
    const title = document.getElementById('mm-title')?.value.trim();
    if (!title) { Toast.error('Toplantı başlığı zorunludur.'); return; }

    const fields = {
      title,
      date:      document.getElementById('mm-date')?.value || toISODateTime(),
      location:  document.getElementById('mm-location')?.value.trim() || '',
      status:    document.getElementById('mm-status')?.value || 'planned',
      notes:     document.getElementById('mm-notes')?.value || '',
      attendees: [..._meetingModalAttendees],
      agenda:    _meetingModalAgenda.map((item, i) => ({ ...item, order: i })),
    };

    const meetingId = document.getElementById('mm-meeting-id')?.value;
    try {
      if (meetingId) {
        await DS.updateMeeting(pid, meetingId, fields);
        Toast.success('Toplantı güncellendi.');
      } else {
        await DS.createMeeting(pid, fields);
        Toast.success('Toplantı oluşturuldu.');
      }
    } catch(e) {
      console.error('[saveMeetingModal]',e);
      Toast.error('Toplantı kaydedilemedi: '+e.message);
      return;
    }
    closeMeetingModal();
    renderMeetingsView();
  }

  async function deleteMeeting(meetingId) {
    const pid = AppState.activeProjectId; if (!pid) return;
    if (!confirm('Bu toplantıyı silmek istediğinizden emin misiniz? Bağlı aksiyonlar bağımsız hale gelecektir.')) return;
    try {
      await DS.deleteMeeting(pid, meetingId);
    } catch(e) {
      console.error('[deleteMeeting]',e);
      Toast.error('Toplantı silinemedi: '+e.message);
      return;
    }
    closeMeetingModal();
    renderMeetingsView();
    Toast.success('Toplantı silindi. Bağlı aksiyonlar korundu.');
  }

  // ── 4.3 Action Modal ─────────────────────────────────────────
  function openActionModal(actionId = null, meetingId = null) {
    const pid = AppState.activeProjectId; if (!pid) return;
    const isPM = AppState.canEdit();
    const members = DS.listMembers(pid);
    const acts    = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    const isNew   = !actionId;
    const action  = actionId ? DS.getAction(pid, actionId) : null;

    // Permission: non-PM can only edit their own actions
    if (!isNew && !isPM) {
      const session = DS.getSession();
      const myMember = session ? members.find(m => m.name+' '+m.surname === session.name) : null;
      if (!myMember || action?.assignee !== myMember.id) {
        Toast.error('Bu aksiyonu düzenleme yetkiniz yok.'); return;
      }
    }

    // Populate selects
    const assigneeSel = document.getElementById('am-assignee');
    if (assigneeSel) assigneeSel.innerHTML = '<option value="">— Üye seçin —</option>'
      + members.map(m => `<option value="${escHtml(m.id)}">${escHtml(m.name+' '+m.surname)}</option>`).join('');

    const actSel = document.getElementById('am-related-activity');
    if (actSel) actSel.innerHTML = '<option value="">— Aktivite seçin —</option>'
      + acts.map(a => `<option value="${escHtml(a.id)}">${escHtml((a.wbsCode?a.wbsCode+' ':'')+a.name)}</option>`).join('');

    // Fill form
    document.getElementById('am-action-id').value  = actionId || '';
    document.getElementById('am-meeting-id').value = meetingId || action?.meetingId || '';
    document.getElementById('am-title').value       = action?.title || '';
    document.getElementById('am-description').value = action?.description || '';
    document.getElementById('am-assignee').value    = action?.assignee || '';
    document.getElementById('am-due-date').value    = action?.dueDate || '';
    document.getElementById('am-priority').value    = action?.priority || 'medium';
    document.getElementById('am-status').value      = action?.status || 'open';
    document.getElementById('am-related-activity').value = action?.relatedActivityId || '';

    // Non-PM: only status editable
    const readonlyFields = ['am-title','am-description','am-assignee','am-due-date','am-priority','am-related-activity'];
    readonlyFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isPM && !isNew;
    });

    document.getElementById('action-modal-title').textContent = isNew ? 'Yeni Aksiyon' : 'Aksiyonu Düzenle';
    const delBtn = document.getElementById('am-delete-btn');
    if (delBtn) { delBtn.style.display = (isNew || !isPM) ? 'none' : ''; delBtn.onclick = () => deleteAction(actionId); }

    document.getElementById('action-modal-overlay')?.classList.add('open');
  }

  function closeActionModal() {
    document.getElementById('action-modal-overlay')?.classList.remove('open');
  }

  async function saveActionModal() {
    const pid    = AppState.activeProjectId; if (!pid) return;
    const isPM   = AppState.canEdit();
    const title  = document.getElementById('am-title')?.value.trim();
    if (!title) { Toast.error('Aksiyon başlığı zorunludur.'); return; }
    const assignee = document.getElementById('am-assignee')?.value;
    if (!assignee) { Toast.error('Atanan kişi zorunludur.'); return; }

    const actionId  = document.getElementById('am-action-id')?.value;
    const meetingId = document.getElementById('am-meeting-id')?.value;

    const fields = {
      title,
      description:       document.getElementById('am-description')?.value || '',
      assignee,
      dueDate:           document.getElementById('am-due-date')?.value || null,
      priority:          document.getElementById('am-priority')?.value || 'medium',
      status:            document.getElementById('am-status')?.value || 'open',
      relatedActivityId: document.getElementById('am-related-activity')?.value || null,
      meetingId:         meetingId || null,
    };

    try {
      if (actionId) {
        // Non-PM can only update status of their own action
        if (!isPM) { await DS.updateAction(pid, actionId, { status: fields.status }); }
        else         { await DS.updateAction(pid, actionId, fields); }
        Toast.success('Aksiyon güncellendi.');
      } else {
        await DS.createAction(pid, fields);
        Toast.success('Aksiyon oluşturuldu.');
      }
    } catch(e) {
      console.error('[saveActionModal]',e);
      Toast.error('Aksiyon kaydedilemedi: '+e.message);
      return;
    }

    closeActionModal();
    // If opened from meeting modal notes tab, refresh that
    if (meetingId) {
      const mid = document.getElementById('mm-meeting-id')?.value;
      if (mid === meetingId) openMeetingModal(meetingId);  // refresh meeting modal
    }
    renderActionsView();
  }

  async function deleteAction(actionId) {
    const pid = AppState.activeProjectId; if (!pid) return;
    if (!confirm('Bu aksiyonu silmek istediğinizden emin misiniz?')) return;
    try {
      await DS.deleteAction(pid, actionId);
    } catch(e) {
      console.error('[deleteAction]',e);
      Toast.error('Aksiyon silinemedi: '+e.message);
      return;
    }
    closeActionModal();
    renderActionsView();
    Toast.success('Aksiyon silindi.');
  }

  // ── 4.4 Action List ───────────────────────────────────────────
  async function renderActionsView() {
    const pid = AppState.activeProjectId; if (!pid) return;
    await DS.syncOverdueActions(pid);
    const isPM = AppState.canEdit();
    const members = DS.listMembers(pid);
    const acts    = DS.listActivities(pid);

    const p = DS.getProject(pid);
    const titleEl = document.getElementById('actions-toolbar-title');
    if (titleEl && p) titleEl.textContent = p.name + ' — Aksiyonlar';

    const btnNew = document.getElementById('btn-new-action');
    if (btnNew) btnNew.style.display = isPM ? '' : 'none';

    // Kanban board: columns are the settable statuses. Overdue actions are still
    // "open" work, so they live in the Açık column flagged red (matches the
    // planned/doing/done mental model and keeps drag→status semantics clean).
    const filterBar = document.getElementById('action-filter-bar');
    if (filterBar) filterBar.style.display = 'none';

    const COLS = [
      { key: 'open',        label: 'Açık' },
      { key: 'in_progress', label: 'Devam Ediyor' },
      { key: 'completed',   label: 'Tamamlandı' },
      { key: 'cancelled',   label: 'İptal' },
    ];
    const colOf = (a) => (a.status === 'overdue' ? 'open' : a.status);
    const session = DS.getSession();
    const canEditAction = (a) => isPM || (session?.memberId && a.assignee === session.memberId);

    const allActions = DS.listActions(pid);
    const byDue = (a, b) => (a.dueDate||'9999').localeCompare(b.dueDate||'9999');

    const cardHtml = (a) => {
      const assigneeMember = a.assignee ? members.find(m => m.id === a.assignee) : null;
      const assigneeName   = assigneeMember ? `${assigneeMember.name} ${assigneeMember.surname}` : '—';
      const relAct         = a.relatedActivityId ? acts.find(x => x.id === a.relatedActivityId) : null;
      const isOver         = a.status === 'overdue';
      const meetingObj     = a.meetingId ? DS.getMeeting(pid, a.meetingId) : null;
      const canEdit        = canEditAction(a);
      return `<div class="kanban-card${isOver?' overdue-card':''}" data-action-id="${escHtml(a.id)}"${canEdit?' draggable="true"':''}>
        <div class="kanban-card-title">${escHtml(a.title)}</div>
        ${a.description ? `<div class="action-card-desc">${escHtml(a.description)}</div>` : ''}
        <div class="action-card-meta">
          <span class="action-priority-badge action-priority-${a.priority}">${ACTION_PRIORITY_TR[a.priority]||a.priority}</span>
          ${isOver ? `<span class="action-status-badge" style="background:var(--color-danger-light);color:var(--color-danger);">Gecikmiş</span>` : ''}
          <span class="meeting-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${escHtml(assigneeName)}
          </span>
          ${a.dueDate ? `<span class="meeting-meta-item" style="${isOver?'color:var(--color-danger);':''}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${fmtDate(a.dueDate)}
          </span>` : ''}
          ${relAct ? `<span class="action-link-chip">${escHtml(relAct.name)}</span>` : ''}
          ${meetingObj ? `<span class="action-link-chip">${escHtml(meetingObj.title)}</span>` : ''}
        </div>
      </div>`;
    };

    const list = document.getElementById('action-list');
    if (!list) return;

    list.className = 'kanban-board';
    list.innerHTML = COLS.map(col => {
      const colActions = allActions.filter(a => colOf(a) === col.key).sort(byDue);
      const cards = colActions.length
        ? colActions.map(cardHtml).join('')
        : `<div class="kanban-empty">—</div>`;
      return `<div class="kanban-col" data-col="${col.key}">
        <div class="kanban-col-header">${col.label} <span class="kanban-col-count">${colActions.length}</span></div>
        <div class="kanban-col-body" data-drop-col="${col.key}">${cards}</div>
      </div>`;
    }).join('');

    // Click card → edit (if allowed)
    list.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', () => openActionModal(card.dataset.actionId));
    });

    // Drag & drop → change status
    let dragId = null;
    list.querySelectorAll('.kanban-card[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', e => { dragId = card.dataset.actionId; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      card.addEventListener('dragend', () => { dragId = null; card.classList.remove('dragging'); list.querySelectorAll('.kanban-col-body.drop-over').forEach(el=>el.classList.remove('drop-over')); });
    });
    list.querySelectorAll('.kanban-col-body').forEach(body => {
      body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('drop-over'); });
      body.addEventListener('dragleave', () => body.classList.remove('drop-over'));
      body.addEventListener('drop', async e => {
        e.preventDefault();
        body.classList.remove('drop-over');
        const id = dragId; if (!id) return;
        const a = DS.getAction(pid, id); if (!a) return;
        const newStatus = body.dataset.dropCol;
        if (colOf(a) === newStatus) return;              // dropped in same column
        if (!canEditAction(a)) { Toast.error('Bu aksiyonu taşıma yetkiniz yok.'); return; }
        try {
          await DS.updateAction(pid, id, { status: newStatus });
        } catch(err) {
          console.error('[kanban drop]', err);
          Toast.error('Aksiyon güncellenemedi: ' + err.message);
          return;
        }
        renderActionsView();
      });
    });
  }

  // ── Wire Phase 4 ──────────────────────────────────────────────
  function wireMeetings() {
    // New meeting
    document.getElementById('btn-new-meeting')?.addEventListener('click', () => openMeetingModal());
    // Modal close
    document.getElementById('meeting-modal-close')?.addEventListener('click', closeMeetingModal);
    document.getElementById('mm-cancel-btn')?.addEventListener('click', closeMeetingModal);
    document.getElementById('meeting-modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'meeting-modal-overlay') closeMeetingModal();
    });
    // Save
    document.getElementById('mm-save-btn')?.addEventListener('click', saveMeetingModal);

    // Tabs
    document.querySelectorAll('.meeting-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.meeting-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.meeting-tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab)?.classList.add('active');
      });
    });

    // Attendee add
    document.getElementById('btn-mm-add-attendee')?.addEventListener('click', () => {
      const sel = document.getElementById('mm-attendee-select');
      const val = sel?.value;
      if (!val || _meetingModalAttendees.includes(val)) return;
      _meetingModalAttendees.push(val);
      renderMeetingAttendees(DS.listMembers(AppState.activeProjectId||''));
      sel.value = '';
    });

    // Agenda add
    document.getElementById('btn-mm-add-agenda')?.addEventListener('click', () => {
      const topic = document.getElementById('mm-agenda-topic')?.value.trim();
      if (!topic) return;
      const dur  = Number(document.getElementById('mm-agenda-dur')?.value) || 0;
      const pres = document.getElementById('mm-agenda-presenter')?.value || null;
      _meetingModalAgenda.push({ id: generateUUID(), topic, duration: dur, presenter: pres || null, order: _meetingModalAgenda.length });
      renderMeetingAgenda(DS.listMembers(AppState.activeProjectId||''));
      document.getElementById('mm-agenda-topic').value = '';
      document.getElementById('mm-agenda-dur').value   = '';
      document.getElementById('mm-agenda-presenter').value = '';
    });
    document.getElementById('mm-agenda-topic')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-mm-add-agenda')?.click();
    });
  }

  function wireActions() {
    document.getElementById('btn-new-action')?.addEventListener('click', () => openActionModal());
    document.getElementById('action-modal-close')?.addEventListener('click', closeActionModal);
    document.getElementById('am-cancel-btn')?.addEventListener('click', closeActionModal);
    document.getElementById('action-modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'action-modal-overlay') closeActionModal();
    });
    document.getElementById('am-save-btn')?.addEventListener('click', saveActionModal);

    // Filter buttons
    document.querySelectorAll('.action-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.action-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _actionFilter = btn.dataset.filter;
        renderActionsView();
      });
    });
  }

  // ================================================================
  // PHASE 5 — AI INTEGRATION (Steps 5.1–5.4)
  // ================================================================

  const AI_LOG_TYPE_TR = {
    risk_report:         'Risk & Gecikme Raporu',
    workload_analysis:   'İş Yükü Analizi',
    meeting_summary:     'Toplantı Özeti',
    delay_alert:         'Gecikme Uyarısı',
    weekly_report:       'Haftalık Rapor',
    activity_suggestion: 'Aktivite Öneri',
  };

  // ── 5.1 API Key management ──────────────────────────────────── (REMOVED)
  // The Anthropic API key now lives server-side only (src/app/api/ai/route.ts,
  // ANTHROPIC_API_KEY env var). The client never reads/writes/holds a key —
  // getApiKey()/wireApiKeySettings() and the settings-api-key UI are gone.
  // AI features are gated purely by PM role now (see renderAIView below).

  // ── 5.2 AI Context Builder ────────────────────────────────────
  function buildAIContext(pid) {
    const p       = DS.getProject(pid);
    const members = DS.listMembers(pid);
    const groups  = DS.listGroups(pid);
    const allActs = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    // Cap at 50 activities for token efficiency (spec §10)
    const acts    = allActs.slice(0, 50);
    const meetings= DS.listMeetings(pid)
                       .sort((a,b) => (b.date||'').localeCompare(a.date||''))
                       .slice(0, 5);
    const openActions = DS.listActions(pid).filter(a => a.status !== 'completed' && a.status !== 'cancelled');

    const memberMap = Object.fromEntries(members.map(m => [m.id, `${m.name} ${m.surname}`]));
    const groupMap  = Object.fromEntries(groups.map(g => [g.id, g.name]));

    const today = toISODate();

    // Project section
    const projectCtx = `## PROJE BİLGİSİ
Ad: ${p?.name || ''}
Kod: ${p?.code || ''}
Durum: ${p?.status || ''}
Başlangıç: ${p?.startDate || '—'}
Bitiş: ${p?.endDate || '—'}
Bütçe: ${p?.budget?.total || 0} ${p?.budget?.currency || 'TRY'}
Bugünkü İlerleme: %${DS.getProjectProgress(pid)}
Toplam Aktivite: ${allActs.length}${allActs.length > 50 ? ` (gösterilen: 50)` : ''}`;

    // Team section
    const teamCtx = `\n## EKİP ÜYELERİ
${members.map(m => `- ${m.name} ${m.surname} | Rol: ${m.role} | Departman: ${m.department || '—'} | Kapasite: ${m.capacity || 8} saat/gün`).join('\n')}`;

    // Activities section
    const actsCtx = `\n## AKTİVİTELER (${acts.length} aktivite)
${acts.map(a => {
      const group    = a.groupId ? groupMap[a.groupId] || '—' : '—';
      const assignees= (a.assignees||[]).map(id => memberMap[id] || id).join(', ') || '—';
      const deps     = (a.dependencies||[]).map(d => `${d.activityId.slice(-6)}(${d.type}${d.lag?',lag:'+d.lag:''})`).join('; ') || '—';
      const overdue  = a.endDate && a.endDate < today && a.status !== 'completed' ? '[GECİKMİŞ]' : '';
      return `- [${a.wbsCode||'—'}] ${a.name} ${overdue}
  Grup: ${group} | Durum: ${a.status} | Öncelik: ${a.priority} | %${a.percentComplete || 0}
  Başlangıç: ${a.startDate||'—'} | Bitiş: ${a.endDate||'—'} | Süre: ${a.duration||0} gün
  Atanan: ${assignees}
  Bağımlılıklar: ${deps}
  Maliyet Planlanan: ${a.cost?.planned||0} | Gerçekleşen: ${a.cost?.actual||0}`;
    }).join('\n')}`;

    // Recent meetings
    const meetingsCtx = meetings.length ? `\n## SON 5 TOPLANTI
${meetings.map(m => `- ${m.title} (${fmtDateTime(m.date)}) | Durum: ${m.status}
  Katılımcılar: ${(m.attendees||[]).map(id=>memberMap[id]||id).join(', ')||'—'}
  Notlar: ${(m.notes||'').slice(0,200)}${(m.notes||'').length>200?'…':''}`).join('\n')}` : '';

    // Open actions
    const actionsCtx = openActions.length ? `\n## AÇIK AKSİYONLAR (${openActions.length})
${openActions.slice(0,20).map(a => `- ${a.title} | Atanan: ${memberMap[a.assignee]||'—'} | Bitiş: ${a.dueDate||'—'} | Durum: ${a.status} | Öncelik: ${a.priority}`).join('\n')}` : '';

    return [projectCtx, teamCtx, actsCtx, meetingsCtx, actionsCtx].filter(Boolean).join('\n');
  }

  // ── Core API call ─────────────────────────────────────────────
  // Calls the Next.js server proxy (src/app/api/ai/route.ts) instead of Anthropic
  // directly. The server holds the API key, verifies the caller is the project's
  // PM via is_project_pm(), and inserts the ai_logs row itself — the client just
  // gets back { text } (or { error }) and refreshes its ai_logs cache afterwards.
  async function callAI(pid, logType, systemPrompt, userMessage) {
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: pid, logType, systemPrompt, userMessage }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || `API hatası: ${resp.status}`);
    return data.text || '';
  }

  // Structured variant: Claude is constrained to a JSON schema and we get back a parsed
  // object (analysis/risks/recommendations). Objective numbers are computed in code, not
  // here — see buildReportMetrics() — so the model never invents figures.
  async function callAIStructured(pid, logType, systemPrompt, userMessage, schema) {
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: pid, logType, systemPrompt, userMessage, schema }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || `API hatası: ${resp.status}`);
    if (!data.data) throw new Error('AI yapılandırılmış yanıt döndürmedi.');
    return data.data;
  }

  // ── Objective, code-computed report metrics (single source of truth) ──
  function buildReportMetrics(pid) {
    const today   = toISODate();
    const p       = DS.getProject(pid);
    const acts    = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    const groups  = DS.listGroups(pid);
    const members = DS.listMembers(pid);
    const actions = DS.listActions(pid);

    const total      = acts.length;
    const completed  = acts.filter(a => a.status === 'completed').length;
    const inProgress = acts.filter(a => a.status === 'in_progress').length;
    const onHold     = acts.filter(a => a.status === 'on_hold').length;
    const notStarted = acts.filter(a => a.status === 'not_started').length;
    const delayedActs= acts.filter(a => a.status !== 'completed' && a.endDate && a.endDate < today && (a.percentComplete || 0) < 100);
    const avgProgress    = total ? Math.round(acts.reduce((s, a) => s + (a.percentComplete || 0), 0) / total) : 0;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;

    const actOpen    = actions.filter(a => a.status === 'open').length;
    const actProg    = actions.filter(a => a.status === 'in_progress').length;
    const actDone    = actions.filter(a => a.status === 'completed').length;
    const actOverdue = actions.filter(a => (a.status === 'open' || a.status === 'in_progress') && a.dueDate && a.dueDate < today).length;

    const currency    = p?.budget?.currency || 'TRY';
    const budget      = p?.budget?.total || 0;
    const plannedCost = acts.reduce((s, a) => s + (a.cost?.planned || 0), 0);
    const actualCost  = acts.reduce((s, a) => s + (a.cost?.actual  || 0), 0);
    const budgetUsePct= budget > 0 ? Math.round((actualCost / budget) * 100) : 0;

    const memberMap = Object.fromEntries(members.map(m => [m.id, `${m.name} ${m.surname}`]));
    const delayedRows = delayedActs.map(a => ({
      name: a.name, wbs: a.wbsCode || '',
      assignees: (a.assignees || []).map(id => memberMap[id] || '?').join(', ') || '—',
      endDate: a.endDate, overdueDays: workingDaysBetween(a.endDate, today), pct: a.percentComplete || 0,
    })).sort((x, y) => y.overdueDays - x.overdueDays);

    const groupProgress = groups.map(g => {
      const ga = acts.filter(a => a.groupId === g.id);
      const pct = ga.length ? Math.round(ga.reduce((s, a) => s + (a.percentComplete || 0), 0) / ga.length) : 0;
      return { label: (g.wbsCode ? g.wbsCode + ' ' : '') + g.name, pct, valueText: pct + '%', color: g.color || 'var(--color-primary)' };
    });

    return { p, today, currency, total, completed, inProgress, onHold, notStarted,
      delayedCount: delayedActs.length, avgProgress, completionRate,
      actOpen, actProg, actDone, actOverdue, openActions: actOpen + actProg,
      budget, plannedCost, actualCost, budgetUsePct, delayedRows, groupProgress,
      memberCount: members.length, groupCount: groups.length };
  }

  // Severity → colour tokens for risk rows / status badges.
  const _sevColor = { 'kritik':'var(--color-danger)', 'yüksek':'#C1666B', 'orta':'var(--color-warning)', 'düşük':'var(--color-text-muted)' };
  const _statusColor = { 'kritik':'var(--color-danger)', 'dikkat':'var(--color-warning)', 'iyi':'var(--color-success)' };
  const _statusLabel = { 'kritik':'🔴 Kritik', 'dikkat':'🟡 Dikkat', 'iyi':'🟢 İyi Durumda' };

  function _indKpi(label, value, sub, danger) {
    return `<div class="ind-kpi">
      <div class="ind-kpi-label">${escHtml(label)}</div>
      <div class="ind-kpi-value"${danger ? ' style="color:var(--color-danger);"' : ''}>${value}</div>
      <div class="ind-kpi-sub">${escHtml(sub || '')}</div>
    </div>`;
  }
  function _indList(items) {
    if (!items || !items.length) return `<div class="ind-empty">—</div>`;
    return `<ul class="ind-list">${items.map(x => `<li>${escHtml(String(x))}</li>`).join('')}</ul>`;
  }

  // ── Rich "industrial" Weekly Status Report ──
  function renderWeeklyReport(container, pid, ai, model) {
    const m = buildReportMetrics(pid);
    const p = m.p || {};
    const statusCls = _statusColor[ai.overall_status] || 'var(--color-text-muted)';

    const kpis =
      _indKpi('Genel İlerleme', m.avgProgress + '%', `${m.completed}/${m.total} tamamlandı`) +
      _indKpi('Tamamlanma', m.completionRate + '%', `${m.inProgress} devam ediyor`) +
      _indKpi('Geciken Aktivite', m.delayedCount, m.delayedCount > 0 ? 'dikkat gerekiyor' : 'gecikme yok', m.delayedCount > 0) +
      _indKpi('Açık Aksiyon', m.openActions, m.actOverdue > 0 ? `${m.actOverdue} gecikmiş` : `${m.actDone} tamamlandı`, m.actOverdue > 0) +
      (m.budget > 0 ? _indKpi('Bütçe Kullanımı', m.budgetUsePct + '%', fmtMoney(m.actualCost, m.currency) + ' / ' + fmtMoney(m.budget, m.currency), m.budgetUsePct > 100) : '');

    const statusSegs = [
      { label: 'Tamamlandı',   value: m.completed,  color: 'var(--status-completed)' },
      { label: 'Devam Ediyor', value: m.inProgress, color: 'var(--status-in-progress)' },
      { label: 'Beklemede',    value: m.onHold,     color: 'var(--color-warning)' },
      { label: 'Başlamadı',    value: m.notStarted, color: 'var(--status-not-started)' },
    ];
    const groupCols = (m.groupProgress || []).map(g => ({
      label: g.label, value: g.pct, valueText: g.pct + '%', color: g.color || 'var(--color-primary)',
    }));

    const risks = (ai.risks || []);
    const riskTable = risks.length ? `
      <table class="ind-risk-table">
        <thead><tr><th>Risk</th><th>Önem</th><th>Etki</th><th>Önerilen Aksiyon</th></tr></thead>
        <tbody>${risks.map(r => `
          <tr>
            <td><strong>${escHtml(r.title || '')}</strong></td>
            <td><span class="ind-sev" style="background:${_sevColor[r.severity] || 'var(--color-text-muted)'};">${escHtml(r.severity || '—')}</span></td>
            <td>${escHtml(r.impact || '')}</td>
            <td>${escHtml(r.recommendation || '')}</td>
          </tr>`).join('')}</tbody>
      </table>` : `<div class="ind-empty">Belirgin risk tespit edilmedi.</div>`;

    const delayedTable = m.delayedRows.length ? `
      <table class="ind-risk-table">
        <thead><tr><th>Aktivite</th><th>Sorumlu</th><th>Planlanan Bitiş</th><th>Gecikme</th><th>%</th></tr></thead>
        <tbody>${m.delayedRows.slice(0, 10).map(d => `
          <tr>
            <td><strong>${escHtml(d.name)}</strong>${d.wbs ? ` <span class="ind-wbs">${escHtml(d.wbs)}</span>` : ''}</td>
            <td>${escHtml(d.assignees)}</td>
            <td>${fmtDate(d.endDate)}</td>
            <td><span class="ind-sev" style="background:var(--color-danger);">+${d.overdueDays} iş günü</span></td>
            <td>${d.pct}%</td>
          </tr>`).join('')}</tbody>
      </table>` : `<div class="ind-empty">✅ Geciken aktivite yok.</div>`;

    container.style.display = '';
    container.innerHTML = `
      <div class="ind-report" id="ind-report">
        <div class="ind-report-head">
          <div>
            <div class="ind-report-kicker">HAFTALIK PROJE DURUM RAPORU</div>
            <div class="ind-report-title">${escHtml(p.name || 'Proje')}</div>
            <div class="ind-report-meta">${escHtml(p.code || '')} · ${fmtDate(m.today)}</div>
          </div>
          <div class="ind-report-head-right">
            <span class="ind-status-badge" style="color:${statusCls};border-color:${statusCls};">${_statusLabel[ai.overall_status] || ai.overall_status || '—'}</span>
            ${_indHeadButtons()}
          </div>
        </div>

        <div class="ind-section">
          <div class="ind-section-title">Yönetici Özeti</div>
          <p class="ind-summary">${escHtml(ai.executive_summary || '')}</p>
        </div>

        <div class="ind-kpi-row">${kpis}</div>

        <div class="ind-grid2">
          <div class="ind-panel rep-card-center">
            <div class="ind-panel-title">Aktivite Durumu</div>
            ${m.total ? _svgDonut(statusSegs, { centerTop: m.total, centerSub: 'aktivite' }) + _svgLegend(statusSegs) : '<div class="ind-empty">Aktivite yok.</div>'}
          </div>
          <div class="ind-panel rep-card-center">
            <div class="ind-panel-title">Genel Tamamlanma</div>
            ${_svgGauge(m.avgProgress, { label: 'ort. ilerleme' })}
            <div class="ind-kpi-sub" style="margin-top:6px;">${m.completed}/${m.total} tamamlandı</div>
          </div>
        </div>

        <div class="ind-section">
          <div class="ind-section-title">Grup Bazında İlerleme (%)</div>
          ${groupCols.length ? _svgColumns(groupCols) : '<div class="ind-empty">Grup yok.</div>'}
        </div>

        <div class="ind-section">
          <div class="ind-section-title">Riskler</div>
          ${riskTable}
        </div>

        <div class="ind-section">
          <div class="ind-section-title">Geciken Aktiviteler</div>
          ${delayedTable}
        </div>

        <div class="ind-grid2">
          <div class="ind-panel">
            <div class="ind-panel-title">Öne Çıkan Gelişmeler</div>
            ${_indList(ai.key_achievements)}
          </div>
          <div class="ind-panel">
            <div class="ind-panel-title">Gelecek Hafta Planı</div>
            ${_indList(ai.next_week_plan)}
          </div>
        </div>

        <div class="ind-section">
          <div class="ind-section-title">Öneriler</div>
          ${_indList(ai.recommendations)}
        </div>

        <div class="ind-report-footer">Bu rapor, proje verileri temel alınarak yapay zeka (Claude ${escHtml(model || 'Sonnet')}) ile üretilmiştir. Sayısal göstergeler sistemden hesaplanmıştır. · ${fmtDateTime(toISODateTime())}</div>
      </div>`;

    _wireIndReport(container);
  }

  // Shared report chrome: header block + footer + print wiring. `body` is the inner HTML
  // between header and footer. Keeps all three industrial reports visually consistent.
  function _indReportShell(kicker, title, meta, statusColor, statusLabel, model, body) {
    return `
      <div class="ind-report" id="ind-report">
        <div class="ind-report-head">
          <div>
            <div class="ind-report-kicker">${escHtml(kicker)}</div>
            <div class="ind-report-title">${escHtml(title)}</div>
            <div class="ind-report-meta">${escHtml(meta)}</div>
          </div>
          <div class="ind-report-head-right">
            ${statusLabel ? `<span class="ind-status-badge" style="color:${statusColor};border-color:${statusColor};">${statusLabel}</span>` : ''}
            ${_indHeadButtons()}
          </div>
        </div>
        ${body}
        <div class="ind-report-footer">Bu rapor, proje verileri temel alınarak yapay zeka (Claude ${escHtml(model || 'Sonnet')}) ile üretilmiştir. Sayısal göstergeler sistemden hesaplanmıştır. · ${fmtDateTime(toISODateTime())}</div>
      </div>`;
  }

  // Report header action buttons (PDF download + close), shared by all report renderers.
  function _indHeadButtons() {
    return `<div class="ind-head-actions">
      <button class="btn btn-ghost btn-sm ind-print-btn" id="ind-print-btn" title="PDF olarak indir">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        PDF İndir
      </button>
      <button class="btn btn-ghost btn-icon ind-close-btn" id="ind-close-btn" title="Kapat" aria-label="Kapat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }

  // Direct one-click PDF download via html2pdf (loaded by the React page into
  // window.__html2pdf). Falls back to the browser print dialog if it isn't ready.
  function _downloadIndReportPDF() {
    const rep = document.getElementById('ind-report');
    if (!rep) return;
    const h2p = window.__html2pdf;
    if (typeof h2p !== 'function') { _printIndReportFallback(); return; }

    const proj = DS.getProject(AppState.activeProjectId);
    const kicker = rep.querySelector('.ind-report-kicker')?.textContent || 'Rapor';
    const base = ((proj?.name || 'Proje') + ' - ' + kicker).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80);

    const btns = rep.querySelector('.ind-head-actions');
    if (btns) btns.style.display = 'none'; // keep the action buttons out of the PDF
    const restore = () => { if (btns) btns.style.display = ''; };

    const opt = {
      margin: [8, 8, 10, 8],
      filename: base + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.ind-panel', '.ind-kpi', '.ind-section', '.rep-card', '.rep-svg', 'tr'] },
    };
    try { Toast.show('PDF hazırlanıyor…', '', 4000); } catch { /* ignore */ }
    h2p().set(opt).from(rep).save().then(restore).catch(err => {
      console.error('[pdf]', err);
      restore();
      Toast.error('PDF oluşturulamadı, yazdırma açılıyor.');
      _printIndReportFallback();
    });
  }

  // Fallback: move the report to <body> and use the browser print dialog (Save as PDF).
  function _printIndReportFallback() {
    const rep = document.getElementById('ind-report');
    if (!rep) { window.print(); return; }
    const ph = document.createComment('ind-report-placeholder');
    const parent = rep.parentNode;
    parent.insertBefore(ph, rep);
    document.body.appendChild(rep);
    document.body.classList.add('printing-report');
    let restored = false;
    const restore = () => {
      if (restored) return; restored = true;
      document.body.classList.remove('printing-report');
      if (ph.parentNode) ph.parentNode.replaceChild(rep, ph);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 60000);
  }

  function _closeIndReport() {
    const c = document.getElementById('ai-result-container');
    if (c) { c.innerHTML = ''; c.style.display = 'none'; }
  }

  function _wireIndReport(container) {
    document.getElementById('ind-print-btn')?.addEventListener('click', _downloadIndReportPDF);
    document.getElementById('ind-close-btn')?.addEventListener('click', _closeIndReport);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Risk matrix table from AI risk objects.
  function _riskTable(risks) {
    if (!risks || !risks.length) return `<div class="ind-empty">Belirgin risk tespit edilmedi.</div>`;
    return `
      <table class="ind-risk-table">
        <thead><tr><th>Risk</th><th>Önem</th><th>Etki</th><th>Önerilen Aksiyon</th></tr></thead>
        <tbody>${risks.map(r => `
          <tr>
            <td><strong>${escHtml(r.title || '')}</strong></td>
            <td><span class="ind-sev" style="background:${_sevColor[r.severity] || 'var(--color-text-muted)'};">${escHtml(r.severity || '—')}</span></td>
            <td>${escHtml(r.impact || '')}</td>
            <td>${escHtml(r.recommendation || '')}</td>
          </tr>`).join('')}</tbody>
      </table>`;
  }

  // Delayed-activities table (code-computed rows from buildReportMetrics).
  function _delayedTable(rows) {
    if (!rows.length) return `<div class="ind-empty">✅ Geciken aktivite yok.</div>`;
    return `
      <table class="ind-risk-table">
        <thead><tr><th>Aktivite</th><th>Sorumlu</th><th>Planlanan Bitiş</th><th>Gecikme</th><th>%</th></tr></thead>
        <tbody>${rows.slice(0, 12).map(d => `
          <tr>
            <td><strong>${escHtml(d.name)}</strong>${d.wbs ? ` <span class="ind-wbs">${escHtml(d.wbs)}</span>` : ''}</td>
            <td>${escHtml(d.assignees)}</td>
            <td>${fmtDate(d.endDate)}</td>
            <td><span class="ind-sev" style="background:var(--color-danger);">+${d.overdueDays} iş günü</span></td>
            <td>${d.pct}%</td>
          </tr>`).join('')}</tbody>
      </table>`;
  }

  // ── Rich Risk & Delay Report ──
  function renderRiskReport(container, pid, ai, model) {
    const m = buildReportMetrics(pid);
    const p = m.p || {};
    const atRisk = (DS.getAtRiskActivities(pid) || []).length;
    const statusCls = _statusColor[ai.overall_status] || 'var(--color-text-muted)';
    const onTimePct = m.total ? Math.round(((m.total - m.delayedCount) / m.total) * 100) : 100;

    const kpis =
      _indKpi('Geciken Aktivite', m.delayedCount, m.delayedCount > 0 ? 'gecikme var' : 'gecikme yok', m.delayedCount > 0) +
      _indKpi('Risk Altında', atRisk, 'yaklaşan bitiş', atRisk > 0) +
      _indKpi('Zamanında', onTimePct + '%', 'planına uygun') +
      _indKpi('Gecikmiş Aksiyon', m.actOverdue, m.actOverdue > 0 ? 'takip gerekiyor' : 'yok', m.actOverdue > 0);

    const body = `
      <div class="ind-section">
        <div class="ind-section-title">Özet</div>
        <p class="ind-summary">${escHtml(ai.summary || '')}</p>
      </div>
      <div class="ind-kpi-row">${kpis}</div>
      <div class="ind-section">
        <div class="ind-section-title">Öncelikli Riskler</div>
        ${_riskTable(ai.risks)}
      </div>
      <div class="ind-section">
        <div class="ind-section-title">Geciken Aktiviteler</div>
        ${_delayedTable(m.delayedRows)}
      </div>
      <div class="ind-grid2">
        <div class="ind-panel">
          <div class="ind-panel-title">Kritik Yol / Bağımlılık Notları</div>
          ${_indList(ai.critical_path_notes)}
        </div>
        <div class="ind-panel">
          <div class="ind-panel-title">Öneriler</div>
          ${_indList(ai.recommendations)}
        </div>
      </div>`;

    container.style.display = '';
    container.innerHTML = _indReportShell('RİSK & GECİKME RAPORU', p.name || 'Proje',
      `${p.code || ''} · ${fmtDate(m.today)}`, statusCls, _statusLabel[ai.overall_status] || ai.overall_status, model, body);
    _wireIndReport(container);
  }

  // ── Rich Workload & Resource Report ──
  function renderWorkloadReport(container, pid, ai, model) {
    const m = buildReportMetrics(pid);
    const p = m.p || {};
    const members = DS.listMembers(pid);
    const acts = DS.listActivities(pid).filter(a => a.status !== 'cancelled' && a.status !== 'completed');
    const rows = members.map(mb => ({
      mb, cnt: acts.filter(a => (a.assignees || []).includes(mb.id)).length,
    })).sort((a, b) => b.cnt - a.cnt);
    const maxLoad = Math.max(1, ...rows.map(r => r.cnt));
    const avgLoad = members.length ? acts.length / members.length : 0;
    const workloadBars = rows.length ? _svgColumns(rows.map(r => ({
      label: r.mb.name,
      value: r.cnt,
      valueText: r.cnt,
      color: r.cnt > Math.ceil(avgLoad) ? 'var(--color-warning)' : 'var(--color-primary)',
    }))) : '<div class="ind-empty">Üye yok.</div>';

    const realloc = (ai.reallocation_suggestions || []);
    const reallocTable = realloc.length ? `
      <table class="ind-risk-table">
        <thead><tr><th>Aktivite / İş</th><th>Kimden</th><th>Kime</th><th>Gerekçe</th></tr></thead>
        <tbody>${realloc.map(r => `
          <tr>
            <td><strong>${escHtml(r.activity || r.task || '')}</strong></td>
            <td>${escHtml(r.from || '—')}</td>
            <td>${escHtml(r.to || '—')}</td>
            <td>${escHtml(r.reason || '')}</td>
          </tr>`).join('')}</tbody>
      </table>` : `<div class="ind-empty">Yeniden dağıtım önerisi yok.</div>`;

    const kpis =
      _indKpi('Ekip Üyesi', members.length, 'toplam') +
      _indKpi('Aktif Aktivite', acts.length, 'tamamlanmamış') +
      _indKpi('Ort. Yük', avgLoad.toFixed(1), 'üye başına') +
      _indKpi('Aşırı Yüklü', (ai.overloaded_members || []).length, 'üye', (ai.overloaded_members || []).length > 0);

    const overloadedList = (ai.overloaded_members || []).map(x =>
      `${x.name || ''}${x.reason ? ' — ' + x.reason : ''}`);
    const underList = (ai.underutilized || []).map(x =>
      `${x.name || ''}${x.note ? ' — ' + x.note : ''}`);

    const body = `
      <div class="ind-section">
        <div class="ind-section-title">Özet</div>
        <p class="ind-summary">${escHtml(ai.summary || '')}</p>
      </div>
      <div class="ind-kpi-row">${kpis}</div>
      <div class="ind-section">
        <div class="ind-section-title">Üye İş Yükü (aktif aktivite sayısı)</div>
        ${workloadBars}
      </div>
      <div class="ind-grid2">
        <div class="ind-panel">
          <div class="ind-panel-title">Aşırı Yüklenmiş Üyeler</div>
          ${_indList(overloadedList)}
        </div>
        <div class="ind-panel">
          <div class="ind-panel-title">Boşta Kapasite</div>
          ${_indList(underList)}
        </div>
      </div>
      <div class="ind-section">
        <div class="ind-section-title">Yeniden Dağıtım Önerileri</div>
        ${reallocTable}
      </div>
      <div class="ind-section">
        <div class="ind-section-title">Öneriler</div>
        ${_indList(ai.recommendations)}
      </div>`;

    container.style.display = '';
    container.innerHTML = _indReportShell('İŞ YÜKÜ & KAYNAK ANALİZİ', p.name || 'Proje',
      `${p.code || ''} · ${fmtDate(m.today)}`, '', '', model, body);
    _wireIndReport(container);
  }

  // ── Result panel helpers ──────────────────────────────────────
  function showAILoading(title) {
    const container = document.getElementById('ai-result-container');
    if (!container) return;
    container.style.display = '';
    container.innerHTML = `<div class="ai-result-panel">
      <div class="ai-result-header">
        <span class="ai-result-title">${escHtml(title)}</span>
      </div>
      <div class="ai-loading">
        <div class="ai-spinner"></div>
        <div class="ai-loading-text">Claude analiz ediyor…</div>
      </div>
    </div>`;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showAIResult(title, text, logType, timestamp) {
    const container = document.getElementById('ai-result-container');
    if (!container) return;
    container.style.display = '';
    container.innerHTML = `<div class="ai-result-panel">
      <div class="ai-result-header">
        <span class="ai-result-title">${escHtml(title)}</span>
        <span class="ai-result-meta">${timestamp ? fmtDateTime(timestamp) : ''}</span>
      </div>
      <div class="ai-result-body">${escHtml(text)}</div>
    </div>`;
  }

  function showAIError(title, message) {
    const container = document.getElementById('ai-result-container');
    if (!container) return;
    container.style.display = '';
    container.innerHTML = `<div class="ai-result-panel">
      <div class="ai-result-header"><span class="ai-result-title">${escHtml(title)}</span></div>
      <div class="ai-error">${escHtml(message)}</div>
    </div>`;
  }

  // ── 5.3 Risk & Delay Report (rich, structured) ────────────────
  const RISK_REPORT_SCHEMA = {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '2-4 cümlelik risk özeti' },
      overall_status: { type: 'string', enum: ['iyi', 'dikkat', 'kritik'] },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            severity: { type: 'string', enum: ['düşük', 'orta', 'yüksek', 'kritik'] },
            impact: { type: 'string' },
            recommendation: { type: 'string' },
          },
          required: ['title', 'severity', 'impact', 'recommendation'],
          additionalProperties: false,
        },
      },
      critical_path_notes: { type: 'array', items: { type: 'string' }, description: 'Kritik yol/bağımlılık gözlemleri' },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'overall_status', 'risks', 'critical_path_notes', 'recommendations'],
    additionalProperties: false,
  };

  async function runRiskReport() {
    const pid = AppState.activeProjectId; if (!pid) return;

    const SYSTEM = `Sen deneyimli bir proje yönetimi danışmanısın. Türkçe, profesyonel yaz. Verilen proje verisini analiz ederek risk raporunun ANALİZ kısımlarını üret: özet, genel durum, öncelikli riskler (önem derecesi, etki, önerilen aksiyon), kritik yol/bağımlılık notları ve öneriler. Sayısal göstergeler ayrıca sistemden hesaplanır; sen sayı uydurma, analize odaklan. Yanıtı yalnızca verilen JSON şemasına uygun ver.`;
    const USER = `Aşağıdaki proje verilerini analiz ederek risk raporunun analiz bölümlerini üret.\n\nPROJE VERİSİ:\n${buildAIContext(pid)}`;

    showAILoading('Risk & Gecikme Raporu hazırlanıyor…');
    document.getElementById('btn-ai-risk')?.setAttribute('disabled', 'true');

    try {
      const ai = await callAIStructured(pid, 'risk_report', SYSTEM, USER, RISK_REPORT_SCHEMA);
      const now = toISODateTime();
      await DS.reloadAILogs(pid);
      renderRiskReport(document.getElementById('ai-result-container'), pid, ai, 'Sonnet 5');
      const lastRun = document.getElementById('ai-risk-last-run');
      if (lastRun) lastRun.textContent = 'Son çalıştırma: ' + fmtDateTime(now);
      renderAILogList(pid);
    } catch (err) {
      showAIError('Risk & Gecikme Raporu', err.message);
    } finally {
      document.getElementById('btn-ai-risk')?.removeAttribute('disabled');
    }
  }

  // ── 5.4 Workload Analysis (rich, structured) ──────────────────
  const WORKLOAD_SCHEMA = {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '2-4 cümlelik iş yükü özeti' },
      overloaded_members: {
        type: 'array',
        items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'], additionalProperties: false },
      },
      underutilized: {
        type: 'array',
        items: { type: 'object', properties: { name: { type: 'string' }, note: { type: 'string' } }, required: ['name', 'note'], additionalProperties: false },
      },
      reallocation_suggestions: {
        type: 'array',
        items: { type: 'object', properties: { activity: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, reason: { type: 'string' } }, required: ['activity', 'from', 'to', 'reason'], additionalProperties: false },
      },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'overloaded_members', 'underutilized', 'reallocation_suggestions', 'recommendations'],
    additionalProperties: false,
  };

  async function runWorkloadAnalysis() {
    const pid = AppState.activeProjectId; if (!pid) return;

    const SYSTEM = `Sen deneyimli bir proje yönetimi danışmanısın. Türkçe, profesyonel yaz. Verilen proje verisini analiz ederek iş yükü raporunun ANALİZ kısımlarını üret: özet, aşırı yüklenmiş üyeler (gerekçe), boşta kapasite, isim bazlı yeniden dağıtım önerileri (hangi aktivite kimden kime) ve optimizasyon önerileri. Üye isimlerini verideki gerçek isimlerle kullan. Sayısal göstergeler ayrıca sistemden hesaplanır. Yanıtı yalnızca verilen JSON şemasına uygun ver.`;
    const USER = `Aşağıdaki proje verilerini analiz ederek iş yükü raporunun analiz bölümlerini üret.\n\nPROJE VERİSİ:\n${buildAIContext(pid)}`;

    showAILoading('İş Yükü & Kaynak Analizi hazırlanıyor…');
    document.getElementById('btn-ai-workload')?.setAttribute('disabled', 'true');

    try {
      const ai = await callAIStructured(pid, 'workload_analysis', SYSTEM, USER, WORKLOAD_SCHEMA);
      const now = toISODateTime();
      await DS.reloadAILogs(pid);
      renderWorkloadReport(document.getElementById('ai-result-container'), pid, ai, 'Sonnet 5');
      const lastRun = document.getElementById('ai-workload-last-run');
      if (lastRun) lastRun.textContent = 'Son çalıştırma: ' + fmtDateTime(now);
      renderAILogList(pid);
    } catch (err) {
      showAIError('İş Yükü & Kaynak Analizi', err.message);
    } finally {
      document.getElementById('btn-ai-workload')?.removeAttribute('disabled');
    }
  }

  // Structured reports are stored as JSON; show a readable summary in the history list
  // instead of raw JSON. Plain-text reports are returned unchanged.
  function _aiLogReadable(resp) {
    const s = (resp || '').trim();
    if (!s.startsWith('{')) return s;
    try {
      const o = JSON.parse(s);
      if (o && typeof o === 'object') {
        const parts = [];
        if (o.executive_summary || o.summary) parts.push(o.executive_summary || o.summary);
        if (Array.isArray(o.risks) && o.risks.length) parts.push('Riskler: ' + o.risks.map(r => r.title).filter(Boolean).join('; '));
        if (Array.isArray(o.overloaded_members) && o.overloaded_members.length) parts.push('Aşırı yüklü: ' + o.overloaded_members.map(x => x.name).filter(Boolean).join('; '));
        if (Array.isArray(o.recommendations) && o.recommendations.length) parts.push('Öneriler: ' + o.recommendations.join('; '));
        if (parts.length) return parts.join('\n\n');
      }
    } catch { /* not JSON — fall through */ }
    return s;
  }

  // Structured reports whose stored JSON can be re-rendered as the full rich report.
  const _STRUCTURED_REPORT_TYPES = ['weekly_report', 'risk_report', 'workload_analysis'];
  function _isStructuredLog(log) {
    return _STRUCTURED_REPORT_TYPES.includes(log.type) && (log.response || '').trim().startsWith('{');
  }
  // Re-render a stored structured report as the full graphical report (charts, KPIs, …).
  function _reopenAIReport(pid, log) {
    const container = document.getElementById('ai-result-container');
    if (!container || !log) return;
    let ai;
    try { ai = JSON.parse(log.response); } catch { return; }
    if (log.type === 'weekly_report') renderWeeklyReport(container, pid, ai, 'Sonnet 5');
    else if (log.type === 'risk_report') renderRiskReport(container, pid, ai, 'Sonnet 5');
    else if (log.type === 'workload_analysis') renderWorkloadReport(container, pid, ai, 'Sonnet 5');
  }

  // ── AI Log List ───────────────────────────────────────────────
  function renderAILogList(pid) {
    // Skip empty responses (e.g. old rows written before the text-extraction fix).
    let logs = DS.listAILogs(pid).filter(l => (l.response || '').trim()).slice().reverse(); // newest first
    if (_aiLogFilter !== 'all') logs = logs.filter(l => l.type === _aiLogFilter);
    const list = document.getElementById('ai-log-list');
    if (!list) return;

    if (!logs.length) {
      list.innerHTML = `<div style="color:var(--color-text-muted);font-size:13px;padding:12px 0;">${_aiLogFilter === 'all' ? 'Henüz AI kaydı yok. Bir modül çalıştırıldığında burada görünecek.' : 'Bu filtrede kayıt yok.'}</div>`;
      return;
    }

    list.innerHTML = logs.map((log, i) => `
      <div class="ai-log-item">
        <div class="ai-log-item-header" data-log-toggle="${i}">
          <span class="ai-log-type-badge ai-log-type-${log.type}">${AI_LOG_TYPE_TR[log.type] || log.type}</span>
          <span class="ai-log-item-date">${fmtDateTime(log.createdAt)}</span>
          ${_isStructuredLog(log) ? `<button class="btn btn-ghost btn-sm ai-log-open" data-log-reopen="${i}">Raporu Aç</button>` : ''}
          <svg class="ai-log-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="ai-log-item-body" id="ai-log-body-${i}">${escHtml(_aiLogReadable(log.response))}</div>
      </div>`).join('');

    list.querySelectorAll('[data-log-reopen]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        _reopenAIReport(pid, logs[Number(el.dataset.logReopen)]);
      });
    });

    list.querySelectorAll('[data-log-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const idx   = el.dataset.logToggle;
        const body  = document.getElementById(`ai-log-body-${idx}`);
        const chev  = el.querySelector('.ai-log-chevron');
        body?.classList.toggle('open');
        chev?.classList.toggle('open');
      });
    });
  }

  // ── Master render ─────────────────────────────────────────────
  function renderAIView() {
    const pid    = AppState.activeProjectId; if (!pid) return;
    const isPM   = AppState.canEdit();

    const p = DS.getProject(pid);
    const titleEl = document.getElementById('ai-toolbar-title');
    if (titleEl && p) titleEl.textContent = p.name + ' — AI Asistan';

    // Status chip in toolbar — AI service is always available now (server-side key).
    const chip = document.getElementById('ai-api-status-chip');
    if (chip) chip.innerHTML = `<span class="api-status api-status-ok" style="padding:2px 8px;"><span class="api-status-dot api-status-dot-ok" style="width:6px;height:6px;"></span>AI servisi hazır</span>`;

    // No-key warning no longer applies.
    const notice = document.getElementById('ai-no-key-notice');
    if (notice) notice.style.display = 'none';

    // Enable/disable module buttons (PM only — AI features are PM-gated, same as legacy).
    const canRun = isPM;
    ['btn-ai-risk', 'btn-ai-workload', 'btn-ai-weekly'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) canRun ? btn.removeAttribute('disabled') : btn.setAttribute('disabled', 'true');
    });

    // Refresh AI logs from Supabase (server writes them; client just displays).
    DS.reloadAILogs(pid).catch(() => {});

    // Last run timestamps from log
    const logs = DS.listAILogs(pid);
    const lastRisk     = logs.filter(l => l.type === 'risk_report').pop();
    const lastWorkload = logs.filter(l => l.type === 'workload_analysis').pop();
    const lastWeekly   = logs.filter(l => l.type === 'weekly_report').pop();
    if (lastRisk)     { const el = document.getElementById('ai-risk-last-run');     if(el) el.textContent = 'Son çalıştırma: ' + fmtDateTime(lastRisk.createdAt); }
    if (lastWorkload) { const el = document.getElementById('ai-workload-last-run'); if(el) el.textContent = 'Son çalıştırma: ' + fmtDateTime(lastWorkload.createdAt); }
    if (lastWeekly)   { const el = document.getElementById('ai-weekly-last-run');   if(el) el.textContent = 'Son çalıştırma: ' + fmtDateTime(lastWeekly.createdAt); }

    // Goto settings link
    document.getElementById('ai-goto-settings')?.addEventListener('click', () => Router.navigate('settings'));

    // Clear the result panel — but DON'T wipe a report the user just generated. A
    // background realtime reload re-runs renderAIView(); without this guard it would
    // hide a freshly rendered report ("geldi ama gitti"). Keep it if it holds one.
    const container = document.getElementById('ai-result-container');
    if (container && !container.querySelector('.ind-report') && !container.querySelector('.ai-result-panel')) {
      container.style.display = 'none';
    }

    renderAILogList(pid);
  }

  // ── Wire Phase 5 ──────────────────────────────────────────────
  function wireAI() {
    document.getElementById('btn-ai-risk')?.addEventListener('click', runRiskReport);
    document.getElementById('btn-ai-workload')?.addEventListener('click', runWorkloadAnalysis);
    document.getElementById('btn-ai-weekly')?.addEventListener('click', runWeeklyReport);

    // Weekly report modal close + copy
    document.getElementById('weekly-report-modal-close')?.addEventListener('click', () => {
      document.getElementById('weekly-report-modal-overlay')?.classList.remove('open');
    });
    document.getElementById('weekly-report-modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'weekly-report-modal-overlay')
        document.getElementById('weekly-report-modal-overlay')?.classList.remove('open');
    });
    document.getElementById('btn-copy-weekly-report')?.addEventListener('click', () => {
      const text = document.getElementById('weekly-report-content')?.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        const msg = document.getElementById('copy-success-msg');
        if (msg) { msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 2000); }
      }).catch(() => Toast.error('Panoya kopyalanamadı.'));
    });

    // AI Log filter buttons
    document.querySelectorAll('[data-log-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-log-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _aiLogFilter = btn.dataset.logFilter;
        const pid = AppState.activeProjectId;
        if (pid) renderAILogList(pid);
      });
    });
  }

  // ================================================================
  // REPORTS VIEW — numeric/visual analytics dashboard.
  // Derives charts and KPIs from the project's own data (activities,
  // actions, groups, members, cost). Read-only: management lands here to
  // see the numbers without editing. No AI text here — that lives in AI Asistan.
  // ================================================================

  // Small helper: percentage of v within total (0 when total is 0).
  function _repPct(v, t) { return t > 0 ? Math.round((v / t) * 100) : 0; }

  // A single stacked horizontal bar from segments [{value,color}] + a legend
  // row [{label,value,color}]. Segments with value 0 are skipped.
  function _repStack(segments) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    const bar = total > 0
      ? segments.filter(s => s.value > 0).map(s =>
          `<span style="width:${(s.value / total) * 100}%;background:${s.color};"></span>`).join('')
      : '';
    const legend = segments.map(s =>
      `<span class="rep-legend-item"><span class="rep-legend-dot" style="background:${s.color};"></span>${escHtml(s.label)} <strong style="margin-left:2px;">${s.value}</strong></span>`).join('');
    return `<div class="rep-stack">${bar}</div><div class="rep-legend">${legend}</div>`;
  }

  // Horizontal labelled bars from rows [{label,pct,valueText,color}].
  function _repBars(rows) {
    if (!rows.length) return `<div class="rep-empty">Veri yok.</div>`;
    return rows.map(r => `
      <div class="rep-bar-row">
        <span class="rep-bar-label" title="${escHtml(r.label)}">${escHtml(r.label)}</span>
        <span class="rep-bar-track"><span class="rep-bar-fill" style="width:${Math.max(0, Math.min(100, r.pct))}%;background:${r.color || 'var(--color-primary)'};"></span></span>
        <span class="rep-bar-val">${escHtml(r.valueText)}</span>
      </div>`).join('');
  }

  // ── SVG chart helpers (dependency-free, theme-aware, print-perfect) ──
  // NOTE: colours and text styles are INLINED (not CSS vars/classes) because the PDF
  // exporter (html2canvas) serialises each SVG to an image and drops external stylesheet
  // rules + can't resolve var() inside SVG attributes — inline keeps them self-contained.
  function _cssVar(name, fallback) {
    try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }
    catch { return fallback; }
  }
  function _rc(c) {
    if (typeof c === 'string' && c.indexOf('var(') === 0) {
      const m = c.match(/var\((--[^),]+)\)/);
      if (m) return _cssVar(m[1], '#888');
    }
    return normalizeGroupColor(c || '#888888');
  }

  // Donut chart from segments [{label,value,color}] with an optional centre label.
  function _svgDonut(segments, opts = {}) {
    const size = opts.size || 150, thickness = opts.thickness || 26;
    const total = segments.reduce((s, x) => s + x.value, 0);
    const cx = size / 2, cy = size / 2, r = (size - thickness) / 2;
    const circ = 2 * Math.PI * r;
    const border = _rc('var(--color-border)'), txt = _cssVar('--color-text', '#1f2937'), sub = _cssVar('--color-text-muted', '#6b7280');
    let offset = 0;
    const arcs = total > 0
      ? segments.filter(s => s.value > 0).map(s => {
          const dash = (s.value / total) * circ;
          const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${_rc(s.color)}" stroke-width="${thickness}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-offset}"/>`;
          offset += dash;
          return el;
        }).join('')
      : '';
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="rep-svg" role="img">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${border}" stroke-width="${thickness}"/>
      <g transform="rotate(-90 ${cx} ${cy})">${arcs}</g>
      ${opts.centerTop != null ? `<text x="${cx}" y="${cy - 1}" text-anchor="middle" style="font-size:22px;font-weight:700;fill:${txt};">${escHtml(String(opts.centerTop))}</text>` : ''}
      ${opts.centerSub != null ? `<text x="${cx}" y="${cy + 17}" text-anchor="middle" style="font-size:11px;fill:${sub};">${escHtml(String(opts.centerSub))}</text>` : ''}
    </svg>`;
  }

  function _svgLegend(segments) {
    return `<div class="rep-legend">${segments.map(s =>
      `<span class="rep-legend-item"><span class="rep-legend-dot" style="background:${_rc(s.color)};"></span>${escHtml(s.label)} <strong style="margin-left:2px;">${s.value}</strong></span>`).join('')}</div>`;
  }

  // Semicircular gauge showing a 0–100 percentage with a coloured arc.
  function _svgGauge(pct, opts = {}) {
    const p = Math.max(0, Math.min(100, pct));
    const w = opts.width || 180, thickness = opts.thickness || 18;
    const r = (w - thickness) / 2, cx = w / 2, cy = w / 2;
    const h = cy + thickness / 2 + 24;
    const semi = Math.PI * r;
    const border = _rc('var(--color-border)'), txt = _cssVar('--color-text', '#1f2937'), sub = _cssVar('--color-text-muted', '#6b7280');
    const color = _rc(opts.color || (p > 100 ? 'var(--color-danger)' : p >= 80 ? 'var(--color-warning)' : 'var(--color-success)'));
    const arc = (rad) => {
      const a = Math.PI + Math.PI * rad;
      return `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
    };
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="rep-svg" role="img">
      <path d="M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}" fill="none" stroke="${border}" stroke-width="${thickness}" stroke-linecap="round"/>
      <path d="M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(Math.min(1, p / 100))}" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" stroke-dasharray="${semi}" stroke-dashoffset="${semi * (1 - Math.min(1, p / 100))}"/>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" style="font-size:22px;font-weight:700;fill:${txt};">${Math.round(pct)}%</text>
      ${opts.label ? `<text x="${cx}" y="${cy + 16}" text-anchor="middle" style="font-size:11px;fill:${sub};">${escHtml(opts.label)}</text>` : ''}
    </svg>`;
  }

  // Vertical column chart from bars [{label,value,color,valueText}]. Scales to width via viewBox.
  function _svgColumns(bars, opts = {}) {
    if (!bars.length) return `<div class="rep-empty">Veri yok.</div>`;
    const slot = 64, padTop = 22, padBottom = 34, plotH = opts.plotH || 130;
    const vbw = bars.length * slot, vbh = padTop + plotH + padBottom;
    const max = opts.max || Math.max(1, ...bars.map(b => b.value));
    const bw = 34;
    const border = _rc('var(--color-border)'), txt = _cssVar('--color-text', '#1f2937'), sub = _cssVar('--color-text-muted', '#6b7280');
    const cols = bars.map((b, i) => {
      const x = i * slot + (slot - bw) / 2;
      const bh = max > 0 ? (b.value / max) * plotH : 0;
      const y = padTop + (plotH - bh);
      const label = String(b.label);
      const short = label.length > 10 ? label.slice(0, 9) + '…' : label;
      return `
        <rect x="${x}" y="${y}" width="${bw}" height="${Math.max(1, bh)}" rx="4" fill="${_rc(b.color || 'var(--color-primary)')}"/>
        <text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" style="font-size:12px;font-weight:600;fill:${txt};">${escHtml(b.valueText != null ? String(b.valueText) : String(b.value))}</text>
        <text x="${x + bw / 2}" y="${padTop + plotH + 15}" text-anchor="middle" style="font-size:11px;fill:${sub};"><title>${escHtml(label)}</title>${escHtml(short)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${vbw} ${vbh}" width="100%" height="${vbh}" preserveAspectRatio="xMidYMid meet" class="rep-svg" role="img">
      <line x1="0" y1="${padTop + plotH}" x2="${vbw}" y2="${padTop + plotH}" stroke="${border}" stroke-width="1"/>
      ${cols}
    </svg>`;
  }

  function renderReportsView() {
    const pid = AppState.activeProjectId; if (!pid) return;
    const p = DS.getProject(pid);
    const titleEl = document.getElementById('reports-toolbar-title');
    if (titleEl) titleEl.textContent = p ? p.name + ' — Raporlar' : 'Raporlar';
    const updEl = document.getElementById('reports-updated');
    if (updEl) updEl.textContent = 'Güncelleme: ' + fmtDateTime(toISODateTime());

    const el = document.getElementById('reports-content');
    if (!el) return;

    const today  = toISODate();
    const acts   = DS.listActivities(pid).filter(a => a.status !== 'cancelled');
    const groups = DS.listGroups(pid);
    const members= DS.listMembers(pid);
    const actions= DS.listActions(pid);

    if (!acts.length && !actions.length) {
      el.innerHTML = `<div class="rep-empty">Bu proje için henüz rapor oluşturacak veri yok. Aktivite ve aksiyon ekledikçe grafikler burada görünecek.</div>`;
      return;
    }

    // ── Activity metrics ──
    const total       = acts.length;
    const completed   = acts.filter(a => a.status === 'completed').length;
    const inProgress  = acts.filter(a => a.status === 'in_progress').length;
    const onHold      = acts.filter(a => a.status === 'on_hold').length;
    const notStarted  = acts.filter(a => a.status === 'not_started').length;
    const delayed     = acts.filter(a => a.status !== 'completed' && a.endDate && a.endDate < today && (a.percentComplete || 0) < 100).length;
    const avgProgress = total ? Math.round(acts.reduce((s, a) => s + (a.percentComplete || 0), 0) / total) : 0;
    const completionRate = _repPct(completed, total);

    // ── Action metrics ──
    const actOpen    = actions.filter(a => a.status === 'open').length;
    const actProg    = actions.filter(a => a.status === 'in_progress').length;
    const actDone    = actions.filter(a => a.status === 'completed').length;
    const actOverdue = actions.filter(a => (a.status === 'open' || a.status === 'in_progress') && a.dueDate && a.dueDate < today).length;
    const openActions = actOpen + actProg;

    // ── Cost metrics ──
    const currency     = p?.budget?.currency || 'TRY';
    const budget       = p?.budget?.total || 0;
    const totalPlanned = acts.reduce((s, a) => s + (a.cost?.planned || 0), 0);
    const totalActual  = acts.reduce((s, a) => s + (a.cost?.actual  || 0), 0);

    // ── KPI cards ──
    const kpis = [
      { label: 'Toplam Aktivite', value: total, sub: `${groups.length} grup` },
      { label: 'Tamamlanma', value: completionRate + '%', sub: `${completed}/${total} tamamlandı` },
      { label: 'Ortalama İlerleme', value: avgProgress + '%', sub: `${inProgress} devam ediyor` },
      { label: 'Geciken Aktivite', value: delayed, sub: delayed > 0 ? 'dikkat gerekiyor' : 'gecikme yok', danger: delayed > 0 },
      { label: 'Açık Aksiyon', value: openActions, sub: actOverdue > 0 ? `${actOverdue} gecikmiş` : `${actDone} tamamlandı`, danger: actOverdue > 0 },
    ];
    const kpiHtml = kpis.map(k => `
      <div class="rep-kpi">
        <div class="rep-kpi-label">${escHtml(k.label)}</div>
        <div class="rep-kpi-value"${k.danger ? ' style="color:var(--color-danger);"' : ''}>${k.value}</div>
        <div class="rep-kpi-sub">${escHtml(k.sub)}</div>
      </div>`).join('');

    const budgetUsePct = budget > 0 ? Math.round((totalActual / budget) * 100) : 0;

    // ── Activity status distribution (donut) ──
    const statusSegs = [
      { label: 'Tamamlandı',   value: completed,  color: 'var(--status-completed)' },
      { label: 'Devam Ediyor', value: inProgress, color: 'var(--status-in-progress)' },
      { label: 'Beklemede',    value: onHold,     color: 'var(--color-warning)' },
      { label: 'Başlamadı',    value: notStarted, color: 'var(--status-not-started)' },
    ];

    // ── Action status distribution (donut) ──
    const actionSegs = [
      { label: 'Tamamlandı',   value: actDone, color: 'var(--status-completed)' },
      { label: 'Devam Ediyor', value: actProg, color: 'var(--status-in-progress)' },
      { label: 'Açık',         value: actOpen, color: 'var(--status-not-started)' },
    ];

    // ── Progress by group (columns) ──
    const groupCols = groups.map(g => {
      const gActs = acts.filter(a => a.groupId === g.id);
      const pct = gActs.length ? Math.round(gActs.reduce((s, a) => s + (a.percentComplete || 0), 0) / gActs.length) : 0;
      return { label: (g.wbsCode ? g.wbsCode : g.name), value: pct, valueText: pct + '%', color: g.color || 'var(--color-primary)' };
    });

    // ── Member workload (active assigned activities, columns) ──
    const activeActs = acts.filter(a => a.status !== 'completed');
    const avgLoad = members.length ? activeActs.length / members.length : 0;
    const workloadCols = members.map(m => {
      const cnt = activeActs.filter(a => (a.assignees || []).includes(m.id)).length;
      return { label: m.name, value: cnt, valueText: cnt, color: cnt > Math.ceil(avgLoad) ? 'var(--color-warning)' : 'var(--color-primary)' };
    }).sort((a, b) => b.value - a.value);

    // ── Cost (columns: budget / planned / actual) ──
    const costCols = [
      { label: 'Bütçe',       value: budget,       valueText: fmtMoney(budget, currency),       color: 'var(--color-primary-light)' },
      { label: 'Planlanan',   value: totalPlanned, valueText: fmtMoney(totalPlanned, currency), color: 'var(--color-primary)' },
      { label: 'Gerçekleşen', value: totalActual,  valueText: fmtMoney(totalActual, currency),  color: totalActual > budget && budget > 0 ? 'var(--color-danger)' : 'var(--color-success)' },
    ];
    const showCost = (budget || totalPlanned || totalActual) > 0;

    el.innerHTML = `
      <div class="rep-kpi-grid">${kpiHtml}</div>

      <div class="rep-charts-hero">
        <div class="rep-card rep-card-center">
          <div class="rep-card-title">Aktivite Durumu</div>
          ${total ? _svgDonut(statusSegs, { centerTop: total, centerSub: 'aktivite' }) + _svgLegend(statusSegs) : '<div class="rep-empty">Aktivite yok.</div>'}
        </div>
        <div class="rep-card rep-card-center">
          <div class="rep-card-title">Genel Tamamlanma</div>
          ${_svgGauge(avgProgress, { label: 'ort. ilerleme' })}
          <div class="rep-kpi-sub" style="margin-top:6px;">${completed}/${total} aktivite tamamlandı</div>
        </div>
        <div class="rep-card rep-card-center">
          <div class="rep-card-title">${budget > 0 ? 'Bütçe Kullanımı' : 'Aksiyon Durumu'}</div>
          ${budget > 0
            ? _svgGauge(budgetUsePct, { label: 'kullanıldı' }) + `<div class="rep-kpi-sub" style="margin-top:6px;">${fmtMoney(totalActual, currency)} / ${fmtMoney(budget, currency)}</div>`
            : (actions.length ? _svgDonut(actionSegs, { centerTop: actions.length, centerSub: 'aksiyon' }) + _svgLegend(actionSegs) : '<div class="rep-empty">Aksiyon yok.</div>')}
        </div>
      </div>

      <div class="rep-cards">
        <div class="rep-card rep-card-wide">
          <div class="rep-card-title">Grup Bazında İlerleme (%)</div>
          ${_svgColumns(groupCols)}
        </div>
        <div class="rep-card rep-card-wide">
          <div class="rep-card-title">Üye İş Yükü (aktif aktivite sayısı)</div>
          ${workloadCols.length ? _svgColumns(workloadCols) : '<div class="rep-empty">Üye yok.</div>'}
        </div>
        ${showCost ? `
        <div class="rep-card rep-card-wide">
          <div class="rep-card-title">Maliyet — Bütçe / Planlanan / Gerçekleşen</div>
          ${_svgColumns(costCols)}
        </div>` : ''}
        ${budget > 0 && actions.length ? `
        <div class="rep-card rep-card-center">
          <div class="rep-card-title">Aksiyon Durumu</div>
          ${_svgDonut(actionSegs, { centerTop: actions.length, centerSub: 'aksiyon' })}${_svgLegend(actionSegs)}
        </div>` : ''}
      </div>`;
  }

  // ================================================================
  // PHASE 5b — AI Steps 5.5–5.8
  // ================================================================

  let _aiLogFilter = 'all';

  // ── 5.5 Meeting Summary & Action Extraction ───────────────────
  async function runMeetingSummary(meetingId) {
    const pid = AppState.activeProjectId; if (!pid) return;
    const m   = DS.getMeeting(pid, meetingId); if (!m) return;
    const members = DS.listMembers(pid);
    const memberMap = Object.fromEntries(members.map(mb => [mb.id, `${mb.name} ${mb.surname}`]));

    const attendeeNames = (m.attendees||[]).map(id => memberMap[id]||id).join(', ') || '—';
    const agendaText = (m.agenda||[]).map((a,i) =>
      `${i+1}. ${a.topic}${a.duration?' ('+a.duration+'dk)':''}${a.presenter?' - Sunan: '+( memberMap[a.presenter]||a.presenter):''}`)
      .join('\n') || '—';

    const SYSTEM = `Sen deneyimli bir toplantı asistanısın. Türkçe yanıt ver. Toplantı bilgilerini analiz ederek yapılandırılmış bir özet ve aksiyon önerileri oluştur.`;
    const USER = `Aşağıdaki toplantıyı analiz et:

BAŞLIK: ${m.title}
TARİH: ${fmtDateTime(m.date)}
YER: ${m.location || '—'}
KATILIMCILAR: ${attendeeNames}

GÜNDEM:
${agendaText}

TOPLANTI NOTLARI:
${m.notes || '(Not girilmemiş)'}

Lütfen şu formatta yanıt ver:

## TOPLANTI ÖZETİ
(2-4 cümlelik kısa özet)

## ANA KARARLAR
(Madde madde, alınan kararlar)

## ÖNERİLEN AKSİYONLAR
(Her aksiyon ayrı satırda şu formatta: AKSIYON: [başlık] | ATANAN: [isim veya "—"] | TARİH: [tarih veya "—"])`;

    // Show loading
    const resultEl = document.getElementById('mm-ai-summarize-result');
    const proposalsEl = document.getElementById('mm-ai-proposals');
    if (resultEl) resultEl.innerHTML = `<div class="ai-loading" style="padding:16px 0;"><div class="ai-spinner"></div><div class="ai-loading-text">Claude analiz ediyor…</div></div>`;
    if (proposalsEl) proposalsEl.innerHTML = '';
    document.getElementById('btn-mm-ai-summarize')?.setAttribute('disabled','true');

    try {
      const result = await callAI(pid, 'meeting_summary', SYSTEM, USER);
      await DS.reloadAILogs(pid);

      // Parse result: split at "ÖNERİLEN AKSİYONLAR" to separate summary from proposals
      const parts = result.split(/##\s*ÖNERİLEN AKSİYONLAR/i);
      const summaryPart = parts[0] || result;
      const actionsPart = parts[1] || '';

      if (resultEl) resultEl.innerHTML = `<div style="font-size:13px;line-height:1.7;white-space:pre-wrap;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--border-radius);padding:12px;margin-bottom:8px;">${escHtml(summaryPart.trim())}</div>`;

      // Parse action proposals
      const actionLines = actionsPart.split('\n').filter(l => l.trim().startsWith('AKSIYON:'));
      if (actionLines.length && proposalsEl) {
        const proposals = actionLines.map(line => {
          const titleMatch    = line.match(/AKSIYON:\s*([^|]+)/i);
          const assigneeMatch = line.match(/ATANAN:\s*([^|]+)/i);
          const dateMatch     = line.match(/TARİH:\s*([^|]+)/i);
          return {
            title:    (titleMatch?.[1]||'').trim(),
            assignee: (assigneeMatch?.[1]||'').trim(),
            dueDate:  (dateMatch?.[1]||'').trim(),
          };
        }).filter(p => p.title);

        if (proposals.length) {
          proposalsEl.innerHTML = `<div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--color-text-muted);">Aksiyon Önerileri (onaylamak için ✓ tıklayın):</div>` +
            proposals.map((p, i) => `
            <div class="ai-proposal-item" id="ai-proposal-${i}">
              <div class="ai-proposal-item-body">
                <div class="ai-proposal-item-title">${escHtml(p.title)}</div>
                <div class="ai-proposal-item-meta">Atanan: ${escHtml(p.assignee||'—')} · Tarih: ${escHtml(p.dueDate||'—')}</div>
              </div>
              <div class="ai-proposal-actions">
                <button type="button" class="btn btn-success btn-sm" style="background:var(--color-success);color:#fff;border:none;" data-approve-proposal="${i}" data-title="${escHtml(p.title)}" data-assignee-name="${escHtml(p.assignee||'')}" data-due="${escHtml(p.dueDate||'')}">✓ Onayla</button>
                <button type="button" class="btn btn-ghost btn-sm" data-dismiss-proposal="${i}">✗</button>
              </div>
            </div>`).join('');

          // Wire approve/dismiss
          proposalsEl.querySelectorAll('[data-approve-proposal]').forEach(btn => {
            btn.addEventListener('click', () => {
              const idx = Number(btn.dataset.approveProposal);
              approveMeetingActionProposal(pid, meetingId, btn.dataset.title, btn.dataset.assigneeName, btn.dataset.due);
              document.getElementById(`ai-proposal-${idx}`)?.remove();
              Toast.success('Aksiyon oluşturuldu.');
              // Refresh meeting modal actions list
              const mmMid = document.getElementById('mm-meeting-id')?.value;
              if (mmMid) openMeetingModal(mmMid);
            });
          });
          proposalsEl.querySelectorAll('[data-dismiss-proposal]').forEach(btn => {
            btn.addEventListener('click', () => {
              const idx = Number(btn.dataset.dismissProposal);
              document.getElementById(`ai-proposal-${idx}`)?.remove();
            });
          });
        }
      }
      renderAILogList(pid);
    } catch(err) {
      if (resultEl) resultEl.innerHTML = `<div class="ai-error">${escHtml(err.message)}</div>`;
    } finally {
      document.getElementById('btn-mm-ai-summarize')?.removeAttribute('disabled');
    }
  }

  async function approveMeetingActionProposal(pid, meetingId, title, assigneeName, dueDateStr) {
    const members = DS.listMembers(pid);
    const member  = members.find(m => (m.name+' '+m.surname).toLowerCase() === assigneeName.toLowerCase());
    // Try to parse ISO date from dueDate string, fall back to null
    let dueDate = null;
    if (dueDateStr && dueDateStr !== '—') {
      // Try direct ISO parse first, then DD.MM.YYYY
      const isoMatch = dueDateStr.match(/(\d{4}-\d{2}-\d{2})/);
      const dmyMatch = dueDateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (isoMatch) dueDate = isoMatch[1];
      else if (dmyMatch) dueDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
    try {
      await DS.createAction(pid, {
        title, meetingId,
        assignee: member?.id || null,
        dueDate,
        priority: 'medium',
        status: 'open',
      });
    } catch(e) {
      console.error('[approveMeetingActionProposal]',e);
      Toast.error('Aksiyon oluşturulamadı: '+e.message);
    }
  }

  // ── 5.6 Weekly Status Report (rich, structured) ───────────────
  const WEEKLY_REPORT_SCHEMA = {
    type: 'object',
    properties: {
      executive_summary: { type: 'string', description: '2-4 cümlelik yönetici özeti' },
      overall_status: { type: 'string', enum: ['iyi', 'dikkat', 'kritik'] },
      key_achievements: { type: 'array', items: { type: 'string' }, description: 'Bu dönem öne çıkan gelişmeler/başarılar' },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            severity: { type: 'string', enum: ['düşük', 'orta', 'yüksek', 'kritik'] },
            impact: { type: 'string' },
            recommendation: { type: 'string' },
          },
          required: ['title', 'severity', 'impact', 'recommendation'],
          additionalProperties: false,
        },
      },
      next_week_plan: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
    required: ['executive_summary', 'overall_status', 'key_achievements', 'risks', 'next_week_plan', 'recommendations'],
    additionalProperties: false,
  };

  async function runWeeklyReport() {
    const pid = AppState.activeProjectId; if (!pid) return;

    const SYSTEM = `Sen deneyimli bir proje yönetimi danışmanısın. Türkçe, profesyonel ve öz yaz. Verilen proje verisini analiz edip bir haftalık durum raporunun ANALİZ kısımlarını üret: yönetici özeti, genel durum değerlendirmesi, öne çıkan gelişmeler, riskler (önem derecesiyle), gelecek hafta planı ve öneriler. ÖNEMLİ: Sayısal göstergeler (ilerleme yüzdesi, aktivite sayıları, bütçe) ayrıca sistemden hesaplanır; sen sayı uydurma, yorum ve analize odaklan. Yanıtı yalnızca verilen JSON şemasına uygun ver.`;
    const context = buildAIContext(pid);
    const USER = `Aşağıdaki proje verilerini analiz ederek haftalık durum raporunun analiz bölümlerini üret.\n\nPROJE VERİSİ:\n${context}`;

    showAILoading('Haftalık Durum Raporu hazırlanıyor…');
    document.getElementById('btn-ai-weekly')?.setAttribute('disabled', 'true');

    try {
      const ai = await callAIStructured(pid, 'weekly_report', SYSTEM, USER, WEEKLY_REPORT_SCHEMA);
      const now = toISODateTime();
      await DS.reloadAILogs(pid);

      const container = document.getElementById('ai-result-container');
      renderWeeklyReport(container, pid, ai, 'Sonnet 5');

      const lastRun = document.getElementById('ai-weekly-last-run');
      if (lastRun) lastRun.textContent = 'Son çalıştırma: ' + fmtDateTime(now);
      renderAILogList(pid);
    } catch (err) {
      showAIError('Haftalık Durum Raporu', err.message);
    } finally {
      document.getElementById('btn-ai-weekly')?.removeAttribute('disabled');
    }
  }

  // ── 5.7 Activity Suggestion Assistant ────────────────────────
  async function runActivitySuggest(activityId) {
    const pid = AppState.activeProjectId; if (!pid) return;
    const act     = DS.getActivity(pid, activityId); if (!act) return;
    const members = DS.listMembers(pid);
    const groups  = DS.listGroups(pid);
    const allActs = DS.listActivities(pid).filter(a => a.status !== 'cancelled' && a.id !== activityId);
    const sameGroup = allActs.filter(a => a.groupId === act.groupId).slice(0, 15);
    const group   = act.groupId ? groups.find(g => g.id === act.groupId) : null;

    const panel = document.getElementById('ai-suggest-panel');
    const content = document.getElementById('ai-suggest-content');
    if (panel) panel.classList.add('visible');
    if (content) content.innerHTML = `<div class="ai-suggest-loading"><div class="ai-suggest-spinner"></div><span>Claude analiz ediyor…</span></div>`;

    const SYSTEM = `Sen deneyimli bir proje planlama asistanısın. Türkçe, kısa ve öz yanıt ver. Sadece istenen JSON formatında yanıt ver, başka açıklama ekleme.`;
    const actDesc = `Aktivite: "${act.name || 'Yeni Aktivite'}"
Grup: ${group?.name || '—'}
Mevcut süre: ${act.duration || 0} gün
Mevcut başlangıç: ${act.startDate || '—'} | Bitiş: ${act.endDate || '—'}`;

    const groupActsDesc = sameGroup.length
      ? `Aynı gruptaki aktiviteler:\n${sameGroup.map(a => `- ${a.name} (${a.duration||0} gün, ${a.status})`).join('\n')}`
      : 'Bu grupta başka aktivite yok.';

    const membersDesc = members.map(m => `- ${m.name} ${m.surname} (${m.department||'—'}, ${m.capacity||8}s/gün)`).join('\n');

    const USER = `${actDesc}

${groupActsDesc}

Ekip üyeleri:
${membersDesc}

Bu aktivite için JSON formatında öneriler üret:
{
  "duration": <sayı - önerilen süre gün olarak>,
  "duration_reason": "<kısa gerekçe>",
  "dependencies": ["<aktivite adı>", ...],
  "resources": ["<üye adı>", ...],
  "resource_reason": "<kısa gerekçe>"
}`;

    try {
      const result = await callAI(pid, 'activity_suggestion', SYSTEM, USER);
      await DS.reloadAILogs(pid);

      // Parse JSON from result
      let suggestions = null;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) suggestions = JSON.parse(jsonMatch[0]);
      } catch {}

      if (!suggestions) {
        if (content) content.innerHTML = `<div style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${escHtml(result)}</div>`;
        return;
      }

      // Build chip UI
      const chips = [];
      if (suggestions.duration) {
        chips.push(`<div style="margin-bottom:6px;">
          <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">Önerilen Süre</div>
          <span class="ai-suggest-chip" data-suggest-type="duration" data-suggest-value="${suggestions.duration}">
            📅 ${suggestions.duration} gün
            <span style="font-size:10px;color:var(--color-text-muted);">— ${escHtml(suggestions.duration_reason||'')}</span>
            <span style="color:var(--color-primary);font-size:11px;">← Uygula</span>
          </span></div>`);
      }
      if (suggestions.resources?.length) {
        chips.push(`<div style="margin-bottom:6px;">
          <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">Önerilen Kaynaklar</div>
          <div class="ai-suggest-chips">${suggestions.resources.map(r =>
            `<span class="ai-suggest-chip" data-suggest-type="resource" data-suggest-value="${escHtml(r)}">👤 ${escHtml(r)} <span style="color:var(--color-primary);font-size:11px;">← Uygula</span></span>`
          ).join('')}</div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px;">${escHtml(suggestions.resource_reason||'')}</div>
        </div>`);
      }
      if (suggestions.dependencies?.length) {
        chips.push(`<div style="margin-bottom:6px;">
          <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">Olası Bağımlılıklar</div>
          <div class="ai-suggest-chips">${suggestions.dependencies.map(d =>
            `<span class="ai-suggest-chip" style="cursor:default;">🔗 ${escHtml(d)}</span>`
          ).join('')}</div>
        </div>`);
      }

      if (content) content.innerHTML = chips.join('') || '<div style="font-size:13px;color:var(--color-text-muted);">Öneri üretilemedi.</div>';

      // Wire duration chip
      content?.querySelectorAll('[data-suggest-type="duration"]').forEach(chip => {
        chip.addEventListener('click', () => {
          if (chip.classList.contains('applied')) return;
          const val = Number(chip.dataset.suggestValue);
          const durInput = document.getElementById('dp-duration');
          if (durInput) { durInput.value = val; durInput.dispatchEvent(new Event('input')); }
          chip.classList.add('applied');
          chip.innerHTML = `✓ ${val} gün uygulandı`;
        });
      });

      // Wire resource chips — find member by name and add to assignees
      content?.querySelectorAll('[data-suggest-type="resource"]').forEach(chip => {
        chip.addEventListener('click', () => {
          if (chip.classList.contains('applied')) return;
          const name = chip.dataset.suggestValue;
          const member = members.find(m => (m.name+' '+m.surname).toLowerCase() === name.toLowerCase());
          if (!member) { Toast.error(`"${name}" adında üye bulunamadı.`); return; }
          // Add to assignees multiselect if not already there
          const sel = document.getElementById('dp-assignees');
          if (sel) {
            for (let opt of sel.options) {
              if (opt.value === member.id) { opt.selected = true; break; }
            }
          }
          chip.classList.add('applied');
          chip.innerHTML = `✓ ${escHtml(name)} eklendi`;
          Toast.success(`${name} atananlar listesine eklendi.`);
        });
      });

    } catch(err) {
      if (content) content.innerHTML = `<div class="ai-error" style="margin:0;">${escHtml(err.message)}</div>`;
    }
  }

  // WIRE: Gantt (Step 2.9 — timescale toggle)
  // ================================================================
  function wireGantt() {
    document.querySelectorAll('.timescale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _ganttScale = btn.dataset.scale || 'week';
        renderGanttView();
      });
    });
  }


  // ================================================================
  // WIRE: Dashboard
  // ================================================================
  // Imports a project exported in the legacy { project, members, groups, activities,
  // meetings, actions } shape. The importing user always becomes the new project's PM
  // (via createProjectWithPM) — any 'pm' entry in the imported members list is downgraded
  // to 'member' (same rule the New Project wizard already applies), and skipped entirely
  // if its email matches the importer's own (avoids a duplicate project_members row).
  // Old ids in the file only make sense within that file, so every cross-reference
  // (groupId, assignees, dependencies, attendees, agenda.presenter, meeting/action links)
  // is rewritten through an old-id -> new-id map built as each row is created.
  async function importProjectFromJSON(raw) {
    let data;
    try { data = JSON.parse(raw); } catch { Toast.error('Geçersiz JSON dosyası.'); return; }
    if (!data.project || !data.project.name) {
      Toast.error('Geçersiz proje dosyası. { project, members, groups, activities, meetings, actions } formatı bekleniyor.');
      return;
    }

    try {
      let baseCode = (data.project.code || 'PRJ').toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'PRJ';
      if (baseCode.length < 2) baseCode = baseCode + 'X';
      baseCode = baseCode.slice(0, 16); // leave room for a numeric suffix (DB limit is 20 chars)

      const authUser = AppState.authUser;
      const emailName = (authUser?.email || 'PM').split('@')[0];
      const pmName = authUser?.user_metadata?.full_name?.split(' ')?.[0] || emailName;
      const pmSurname = authUser?.user_metadata?.full_name?.split(' ')?.slice(1).join(' ') || '';

      // The DB's unique constraint on projects.code is the real source of truth (the
      // client's cached project list can be stale) — try the code as-is, and only on
      // an actual duplicate-key error from Postgres fall back to a numbered suffix.
      let proj;
      let code = baseCode;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          proj = await DS.createProjectWithPM({ ...data.project, code }, pmName, pmSurname);
          break;
        } catch (err) {
          const isDuplicate = /duplicate key|projects_code_key/i.test(err?.message || '');
          if (!isDuplicate || attempt === 7) throw err;
          code = `${baseCode}_${attempt + 2}`.slice(0, 20);
        }
      }
      if (data.project.status) {
        proj = await DS.updateProject(proj.id, { status: data.project.status }) || proj;
      }
      const pid = proj.id;

      // project_members.email has a NOT NULL + format CHECK constraint at the DB level —
      // members with a missing/malformed email in the import file are skipped rather
      // than failing the whole import; we tell the user how many were dropped.
      const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      let skippedMembers = 0;
      const memberIdMap = {};
      for (const m of (data.members || [])) {
        if (authUser?.email && m.email && m.email.toLowerCase() === authUser.email.toLowerCase()) continue;
        if (!m.email || !EMAIL_RE.test(m.email)) { skippedMembers++; continue; }
        const created = await DS.createMember(pid, { ...m, role: m.role === 'pm' ? 'member' : (m.role || 'member') });
        if (m.id) memberIdMap[m.id] = created.id;
      }
      const remapMember = (oldId) => (oldId && memberIdMap[oldId]) || null;

      const groupIdMap = {};
      const groupsIn = data.groups || [];
      for (let gi = 0; gi < groupsIn.length; gi++) {
        const g = groupsIn[gi];
        // Fall back to array index for sort order so imported groups keep their file
        // order instead of all collapsing to sort_order 0.
        const created = await DS.createGroup(pid, { ...g, parentId: null, order: g.order ?? gi });
        if (g.id) groupIdMap[g.id] = created.id;
      }
      for (const g of groupsIn) {
        if (g.parentId && groupIdMap[g.id] && groupIdMap[g.parentId]) {
          await DS.updateGroup(pid, groupIdMap[g.id], { parentId: groupIdMap[g.parentId] });
        }
      }

      const activityIdMap = {};
      const activitiesIn = data.activities || [];
      for (let ai = 0; ai < activitiesIn.length; ai++) {
        const a = activitiesIn[ai];
        const created = await DS.createActivity(pid, {
          ...a,
          order: a.order ?? ai, // preserve file order within each group
          groupId: (a.groupId && groupIdMap[a.groupId]) || null,
          assignees: (a.assignees || []).map(remapMember).filter(Boolean),
        });
        if (a.id) activityIdMap[a.id] = created.id;
      }
      for (const a of (data.activities || [])) {
        const deps = (a.dependencies || [])
          .map(d => ({ ...d, activityId: activityIdMap[d.activityId] }))
          .filter(d => d.activityId);
        if (deps.length && activityIdMap[a.id]) {
          await DS.updateActivity(pid, activityIdMap[a.id], { dependencies: deps });
        }
      }

      const meetingIdMap = {};
      for (const m of (data.meetings || [])) {
        const created = await DS.createMeeting(pid, {
          ...m,
          attendees: (m.attendees || []).map(remapMember).filter(Boolean),
          agenda: (m.agenda || []).map(item => ({ ...item, presenter: remapMember(item.presenter) })),
        });
        if (m.id) meetingIdMap[m.id] = created.id;
      }

      for (const a of (data.actions || [])) {
        await DS.createAction(pid, {
          ...a,
          assignee: remapMember(a.assignee),
          meetingId: (a.meetingId && meetingIdMap[a.meetingId]) || null,
          relatedActivityId: (a.relatedActivityId && activityIdMap[a.relatedActivityId]) || null,
        });
      }

      await renderDashboard();
      Toast.success(`"${proj.name}" projesi içe aktarıldı.` + (skippedMembers ? ` (${skippedMembers} üye geçersiz e-posta nedeniyle atlandı.)` : ''));
    } catch (e) {
      console.error('[importProjectFromJSON]', e);
      Toast.error('İçe aktarma başarısız: ' + e.message);
    }
  }

  function wireDashboard() {
    document.querySelectorAll('.filter-pill').forEach(btn=>{
      btn.addEventListener('click',()=>{
        _dashFilter=btn.dataset.filter||'all';
        document.querySelectorAll('.filter-pill').forEach(b=>b.classList.toggle('active',b.dataset.filter===_dashFilter));
        renderDashboard();
      });
    });
    document.getElementById('btn-new-project')?.addEventListener('click',()=>Wizard.open());
    document.getElementById('btn-new-project-empty')?.addEventListener('click',()=>Wizard.open());
    document.getElementById('json-import-input')?.addEventListener('change', e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => importProjectFromJSON(ev.target.result);
      reader.readAsText(file);
    });
  }

  // Only visible/usable by users who are already management (see AppState.isGlobalManagement
  // in boot()) — grants/revokes another user's profiles.is_management flag via the
  // set_user_management_flag() RPC, which itself re-checks is_management() server-side.
  function wireManagementAdmin() {
    const overlay = document.getElementById('management-modal-overlay');
    const openModal = () => {
      document.getElementById('mgmt-email').value = '';
      document.getElementById('mgmt-flag').value = 'true';
      document.getElementById('err-mgmt').textContent = '';
      overlay?.classList.add('open');
    };
    const closeModal = () => overlay?.classList.remove('open');

    document.getElementById('btn-manage-management')?.addEventListener('click', openModal);
    document.getElementById('management-modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('mgmt-cancel-btn')?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    document.getElementById('mgmt-save-btn')?.addEventListener('click', async () => {
      const email = document.getElementById('mgmt-email').value.trim();
      const grant = document.getElementById('mgmt-flag').value === 'true';
      const errEl = document.getElementById('err-mgmt');
      if (!email) { errEl.textContent = 'E-posta zorunludur.'; return; }
      errEl.textContent = '';
      const btn = document.getElementById('mgmt-save-btn');
      btn.disabled = true;
      try {
        const res = await supabase.rpc('set_user_management_flag', { p_email: email, p_is_management: grant });
        if (res.error) throw new Error(res.error.message);
        Toast.success(grant ? `${email} artık yönetim erişimine sahip.` : `${email} için yönetim erişimi kaldırıldı.`);
        closeModal();
      } catch (e) {
        errEl.textContent = e.message || 'İşlem başarısız.';
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ================================================================
  // WIRE: Wizard
  // ================================================================
  function wireWizard() {
    document.getElementById('wizard-close-btn')?.addEventListener('click',()=>Wizard.close());
    document.getElementById('wiz-cancel-btn')?.addEventListener('click',()=>Wizard.close());
    document.getElementById('wizard-overlay')?.addEventListener('click',e=>{ if(e.target.id==='wizard-overlay') Wizard.close(); });
    const nameInput=document.getElementById('wiz-name');
    const codeInput=document.getElementById('wiz-code');
    if(nameInput&&codeInput){
      nameInput.addEventListener('input',()=>{
        if(codeInput.__userEdited) return;
        const slug=nameInput.value.trim().toUpperCase().replace(/[^A-Z0-9\s]/g,'').split(/\s+/).filter(Boolean).slice(0,3).map(w=>w.slice(0,4)).join('-');
        codeInput.value=slug;
      });
      codeInput.addEventListener('input',()=>{ codeInput.__userEdited=true; });
    }
    document.getElementById('btn-add-member')?.addEventListener('click',()=>Wizard._addMember());
    ['mem-name','mem-surname','mem-dept','mem-email','mem-capacity'].forEach(id=>{
      document.getElementById(id)?.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();Wizard._addMember();} });
    });
    document.getElementById('wiz-next-btn')?.addEventListener('click',async()=>{
      const s=Wizard.currentStep;
      if(s===1){ if(await Wizard._validateStep1()) Wizard._goToStep(2); }
      else if(s===2){ if(Wizard._validateStep2()) Wizard._goToStep(3); }
      else if(s===3){ await Wizard._createProject(); }
    });
    document.getElementById('wiz-back-btn')?.addEventListener('click',()=>{
      if(Wizard.currentStep>1) Wizard._goToStep(Wizard.currentStep-1);
    });
  }

  // ================================================================
  // WIRE: Navigation & Session Screen
  // ================================================================
  // Auth rewrite: no more role select / member select / PIN digits — the session
  // screen just shows a spinner then either grants access (via SessionScreen._resolve)
  // or shows an access-denied message. Only the "back to dashboard" and user-pill
  // (re-check access) affordances remain wired here.
  // ── Active-project switcher (sidebar dropdown) ────────────────
  async function toggleProjectDropdown() {
    const dd = document.getElementById('sidebar-project-dropdown');
    if (!dd) return;
    if (dd.style.display !== 'none') { closeProjectDropdown(); return; }
    await renderProjectDropdown();
    dd.style.display = '';
    document.getElementById('sidebar-project-name')?.classList.add('open');
  }

  function closeProjectDropdown() {
    const dd = document.getElementById('sidebar-project-dropdown');
    if (dd) dd.style.display = 'none';
    document.getElementById('sidebar-project-name')?.classList.remove('open');
  }

  async function renderProjectDropdown() {
    const dd = document.getElementById('sidebar-project-dropdown');
    if (!dd) return;
    let projects = DS.listProjects();
    if (!projects.length) {
      dd.innerHTML = `<div class="sidebar-proj-dd-empty">Yükleniyor…</div>`;
      try { await DS.loadAllProjects(); } catch { /* ignore */ }
      projects = DS.listProjects();
    }
    if (!projects.length) {
      dd.innerHTML = `<div class="sidebar-proj-dd-empty">Henüz proje yok.</div>`;
      return;
    }
    const activeId = AppState.activeProjectId;
    dd.innerHTML =
      projects.map(p => `
        <div class="sidebar-proj-dd-item${p.id === activeId ? ' active' : ''}" data-proj-id="${p.id}">
          <span class="sidebar-proj-dd-name">${escHtml(p.name)}</span>
          ${p.id === activeId ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>`).join('') +
      `<div class="sidebar-proj-dd-item sidebar-proj-dd-all" data-proj-all="1"><span>Tüm Projeler…</span></div>`;

    dd.querySelectorAll('[data-proj-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.projId;
        closeProjectDropdown();
        if (id === AppState.activeProjectId) return; // already active — do nothing
        await openProject(id);
      });
    });
    dd.querySelector('[data-proj-all]')?.addEventListener('click', () => {
      closeProjectDropdown();
      Router.navigate('dashboard');
    });
  }

  function wireNavigation() {
    document.querySelectorAll('.nav-link[data-view]').forEach(el=>{
      el.addEventListener('click',()=>Router.navigate(el.dataset.view));
    });
    document.getElementById('sidebar-project-name')?.addEventListener('click',(e)=>{
      e.stopPropagation();
      toggleProjectDropdown();
    });
    // Close the switcher when clicking anywhere else.
    document.addEventListener('click',(e)=>{
      const dd = document.getElementById('sidebar-project-dropdown');
      const box = document.getElementById('sidebar-project-name');
      if(dd && dd.style.display!=='none' && !dd.contains(e.target) && !box.contains(e.target)) {
        closeProjectDropdown();
      }
    });
    document.getElementById('topbar-settings-btn')?.addEventListener('click',()=>Router.navigate('settings'));

    document.getElementById('session-back-to-dashboard')?.addEventListener('click',async()=>{
      SessionScreen.hide();
      await AppState.setActiveProject(null);
      Router.navigate('dashboard');
    });
    document.getElementById('user-pill')?.addEventListener('click',()=>{
      if(AppState.activeProjectId) SessionScreen.show(AppState.activeProjectId);
    });
    document.getElementById('btn-sign-out')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await supabase.auth.signOut();
      window.location.href = '/login';
    });
  }

  // ================================================================
  // BOOT
  // ================================================================
  async function boot() {
    // Resolve the authenticated Supabase user up front. Middleware already redirects
    // unauthenticated visitors to /login before this route renders, but we still guard
    // here in case the client-side session hasn't hydrated yet.
    const { data: { user } } = await supabase.auth.getUser();
    AppState.authUser = user || null;
    AppState.setSession(null);

    // Links any project_members rows a PM invited by this user's email before they
    // ever showed up here — without this, an invited member has no way to discover
    // a project they haven't opened yet (RLS only shows projects they're already
    // linked to, and there's no project id to open until they're linked).
    if (AppState.authUser) {
      try { await supabase.rpc('claim_all_pending_memberships'); } catch { /* best-effort */ }
    }

    // Global (not per-project) management flag — controls the "Yönetim Erişimi" admin
    // button, which lets existing management users grant/revoke the flag for others
    // without ever touching the Supabase dashboard.
    // Single system admin: only this fixed account may assign management (mirrors the
    // hard-coded check in set_user_management_flag). The admin also gets management
    // (read-all) access; the "Yönetim Erişimi" button is shown only to them.
    AppState.isGlobalManagement = false;
    const isSuperAdmin = !!(AppState.authUser && AppState.authUser.email &&
      AppState.authUser.email.toLowerCase() === SUPER_ADMIN_EMAIL);
    if (AppState.authUser) {
      const { data: ownProfile } = await supabase.from('profiles').select('is_management').eq('id', AppState.authUser.id).maybeSingle();
      AppState.isGlobalManagement = !!ownProfile?.is_management;
      // Ensure the admin is flagged management (so RLS lets them read every project).
      if (isSuperAdmin && !AppState.isGlobalManagement) {
        try {
          await supabase.rpc('set_user_management_flag', { p_email: AppState.authUser.email, p_is_management: true });
          AppState.isGlobalManagement = true;
        } catch (e) { console.warn('[super-admin self-grant]', e); }
      }
    }
    const mgmtBtn = document.getElementById('btn-manage-management');
    if (mgmtBtn) mgmtBtn.style.display = isSuperAdmin ? '' : 'none';

    await renderDashboard();

    const ls=document.getElementById('loading-screen');
    if(ls){ ls.style.opacity='0'; setTimeout(()=>ls.classList.add('hidden'),300); }
    document.getElementById('app').style.display='';
    wireNavigation();
    wireDashboard();
    wireManagementAdmin();
    wireWizard();
    wireMemberManagement();
    wireSettings();
    wireActivities();
    wireGantt();
    wireMeetings();
    wireActions();
    wireAI();

    // Register the view listener BEFORE Router.init(): init() synchronously activates the
    // current hash and dispatches 'viewActivated' immediately, so a listener added after
    // it would miss that first activation (leaving e.g. the activities list stuck on
    // "Yükleniyor…" on a refresh into #activities).
    document.addEventListener('viewActivated',e=>{
      const v=e.detail.view;
      if(v==='dashboard')   renderDashboard();
      if(v==='members')     renderMembersView();
      if(v==='settings')    renderSettingsView();
      if(v==='activities')  renderActivitiesView();
      if(v==='gantt')        renderGanttView();
      if(v==='tracking')   renderTrackingView();
      if(v==='meetings')   renderMeetingsView();
      if(v==='actions')    renderActionsView();
      if(v==='ai')         renderAIView();
      if(v==='reports')    renderReportsView();
    });

    // Restore the previously open project (if any) BEFORE Router.init, so that when the
    // router activates the current hash (e.g. #activities) the project is already loaded
    // and the view isn't bounced back to the dashboard.
    await restoreActiveProject();

    Router.init();
  }

  // ================================================================
  // DEMO DATA SEEDER — builds a fully-populated example project so the
  // dashboard/reports/Gantt look complete for a demo. Run once from the
  // browser console (F12):   seedDemoProject()
  // It writes through the normal DS layer as the logged-in PM, so it
  // respects RLS. To remove everything, just delete the created
  // "TPM Uygulama Projesi (Örnek)" project from the UI.
  // ================================================================
  async function seedDemoProject() {
    const iso  = n => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
    const isoT = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString(); };
    const slug = s => s.toLowerCase().replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]/g,'');
    try {
      Toast.show('Örnek proje oluşturuluyor… (birkaç saniye sürebilir)', '', 6000);

      const authUser  = AppState.authUser;
      const emailName = (authUser?.email || 'PM').split('@')[0];
      const pmName    = authUser?.user_metadata?.full_name?.split(' ')?.[0] || emailName;
      const pmSurname = authUser?.user_metadata?.full_name?.split(' ')?.slice(1).join(' ') || '';

      const proj = await DS.createProjectWithPM({
        name: 'TPM Uygulama Projesi (Örnek)',
        code: 'OPEX-DEMO-' + Date.now().toString().slice(-4),
        description: 'Toplam Üretken Bakım (TPM) uygulamasının OPEX kapsamında pilot hatta hayata geçirilmesi. Bu bir örnek/demo projesidir; istediğiniz zaman silebilirsiniz.',
        startDate: iso(-60), endDate: iso(120),
        baselineStartDate: iso(-60), baselineEndDate: iso(120),
        budget: { total: 1200000, currency: 'TRY', spent: 0 },
      }, pmName, pmSurname);
      const pid = proj.id;

      // ── Members ──
      const memberDefs = [
        { name:'Furkan',    surname:'Büyükyavuz', department:'OPEX',    capacity:8 },
        { name:'Şemsettin', surname:'Turhan',     department:'Yönetim', capacity:6 },
        { name:'Ayşe',      surname:'Demir',      department:'Üretim',  capacity:8 },
        { name:'Mehmet',    surname:'Kaya',       department:'Bakım',   capacity:8 },
        { name:'Elif',      surname:'Yıldız',     department:'Kalite',  capacity:7 },
      ];
      const M = [];
      for (const md of memberDefs) {
        const created = await DS.createMember(pid, {
          ...md, role:'member',
          email: slug(md.name) + '.' + slug(md.surname) + '@ornek.local',
        });
        M.push(created.id);
      }

      // ── Groups (WBS) ──
      const groupDefs = [
        { name:'Hazırlık & Eğitim',            color:'#4C6285' },
        { name:'Otonom Bakım (Jishu Hozen)',   color:'#4E8E6A' },
        { name:'Planlı Bakım',                 color:'#B08968' },
        { name:'Kalite Bakımı',                color:'#8E7CC3' },
        { name:'Kapanış & Standardizasyon',    color:'#C1666B' },
      ];
      const G = [];
      for (let i=0;i<groupDefs.length;i++){
        const g = await DS.createGroup(pid, { name: groupDefs[i].name, color: groupDefs[i].color, order: i });
        G.push(g.id);
      }

      // ── Activities ──
      // [groupIdx, name, status, pct, startOffset, endOffset, planned, actual, [assigneeIdxs]]
      const acts = [
        [0,'TPM kick-off toplantısı',                 'completed',  100, -58, -56,  20000, 18500, [0,1]],
        [0,'Mevcut durum analizi (OEE ölçümü)',       'completed',  100, -55, -45,  60000, 63000, [0,2]],
        [0,'Ekip eğitimi — TPM temelleri',            'completed',  100, -44, -38,  45000, 44000, [1,4]],
        [0,'Pilot hat seçimi ve hedef belirleme',     'completed',  100, -37, -33,  15000, 15000, [0]],

        [1,'Ekipman temizliği ve ilk denetim',        'completed',  100, -32, -25,  30000, 31500, [2,3]],
        [1,'Kaynak kirlilik noktalarının tespiti',    'in_progress', 70, -24,  -6,  40000, 28000, [3]],
        [1,'Otonom bakım standartları hazırlığı',     'in_progress', 45, -10,   8,  35000, 12000, [2,3]],
        [1,'Operatör kontrol listeleri',              'not_started',  0,  -3,  -1,  20000,     0, [2]],   // geciken

        [2,'Kritik ekipman envanteri',                'completed',  100, -20, -12,  25000, 24000, [3]],
        [2,'Planlı bakım takvimi oluşturma',          'in_progress', 55,  -8,  10,  50000, 26000, [3,4]],
        [2,'Yedek parça stok optimizasyonu',          'not_started',  0,  -2,  -1,  30000,     0, [3]],   // geciken
        [2,'Bakım KPI panosu kurulumu',               'not_started',  0,   4,  18,  40000,     0, [0,3]], // yaklaşan

        [3,'Kalite kayıp analizi',                    'in_progress', 35,  -6,  14,  45000, 15000, [4]],
        [3,'Hata modu ve etkileri analizi (FMEA)',    'not_started',  0,   6,  25,  55000,     0, [4,1]], // yaklaşan
        [3,'Poka-yoke uygulamaları',                  'not_started',  0,  20,  40,  60000,     0, [4]],

        [4,'Standart operasyon prosedürleri',         'not_started',  0,  30,  55,  50000,     0, [0,2]],
        [4,'Proje kapanış raporu',                    'not_started',  0,  60,  75,  20000,     0, [0]],
      ];
      for (let i=0;i<acts.length;i++){
        const [gi,name,status,pct,so,eo,planned,actual,as] = acts[i];
        await DS.createActivity(pid, {
          groupId: G[gi], name, status, percentComplete: pct,
          startDate: iso(so), endDate: iso(eo),
          cost: { planned, actual }, priority: 'medium',
          assignees: as.map(x => M[x]), order: i,
        });
      }

      // ── Actions ── [title, status, dueOffset, priority, assigneeIdx]
      const actionDefs = [
        ['Kaynak kirlilik listesi güncellensin',       'in_progress',  3, 'high',   3],
        ['Operatör kontrol listeleri tamamlansın',     'open',        -4, 'high',   2],  // gecikmiş
        ['Yedek parça tedarikçisiyle görüşme',         'open',         6, 'medium', 3],
        ['Planlı bakım takvimi onaya sunulsun',        'in_progress',  2, 'medium', 4],
        ['OEE panosu ekranı sipariş edilsin',          'open',        -2, 'medium', 0],  // gecikmiş
        ['Kick-off aksiyon maddeleri kapatıldı',       'completed',  -48, 'low',    0],
        ['Eğitim materyalleri arşivlendi',             'completed',  -39, 'low',    1],
      ];
      for (const [title,status,due,priority,ai] of actionDefs){
        await DS.createAction(pid, { title, status, dueDate: iso(due), priority, assignee: M[ai] });
      }

      // ── Meetings ──
      await DS.createMeeting(pid, {
        title:'TPM Haftalık Değerlendirme', date: isoT(-7), location:'Toplantı Odası A', status:'completed',
        attendees:[M[0],M[2],M[3]],
        agenda:[{topic:'Otonom bakım ilerlemesi', duration:20, presenter:M[3]},{topic:'Geciken maddelerin gözden geçirilmesi', duration:15, presenter:M[0]}],
      });
      await DS.createMeeting(pid, {
        title:'Planlı Bakım Planlama', date: isoT(2), location:'Online (Teams)', status:'planned',
        attendees:[M[3],M[4]],
        agenda:[{topic:'Bakım takvimi taslağı', duration:30, presenter:M[3]},{topic:'KPI panosu gereksinimleri', duration:20, presenter:M[0]}],
      });

      Toast.success('Örnek proje oluşturuldu: ' + proj.name);
      await renderDashboard();
      return pid;
    } catch(e) {
      console.error('[seedDemoProject]', e);
      Toast.error('Örnek proje oluşturulamadı: ' + (e?.message || e));
    }
  }

  // ================================================================
  // GLOBAL EXPOSURE
  // ================================================================
  window.PM={DS,Router,AppState,Toast,SessionScreen,Wizard,
    renderDashboard,renderMembersView,renderSettingsView,renderActivitiesView,renderGanttView,renderTrackingView,renderMeetingsView,renderActionsView,renderAIView,renderReportsView,
    Utils:{generateUUID,sha256,toISODate,toISODateTime,workingDaysBetween,escHtml,fmtDate,fmtMoney}};
  window.Wizard=Wizard;
  window.openProject=openProject;
  window.confirmDeleteProject=confirmDeleteProject;
  window.seedDemoProject=seedDemoProject;   // demo: run seedDemoProject() in the console

  // Loaded via next/script strategy="afterInteractive", i.e. well after the DOM is
  // parsed/hydrated — DOMContentLoaded has already fired by then, so that listener
  // would never run. Boot immediately (readyState is always 'interactive'/'complete' here).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
