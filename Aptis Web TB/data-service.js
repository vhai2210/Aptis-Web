(function () {
  "use strict";

  const CHUNK_SIZE = 500;
  const SYSTEM_GRADE_RULE_TYPE = "__owlstudy_grade_rule__";
  const SYSTEM_SITE_SETTING_TYPE = "__owlstudy_site_setting__";
  const DEFAULT_GRADE_TARGETS = {
    D: 4,
    "D+": 5,
    C: 5.5,
    "C+": 6.5,
    B: 7,
    "B+": 8,
    A: 8.5
  };
  const PUBLIC_CACHE_TTL_MS = 5 * 60 * 1000;
  const PUBLIC_CACHE_PREFIX = "owlStudyPublicCache:";

  function publicCacheKey(name, options = {}) {
    return PUBLIC_CACHE_PREFIX + name + ":" + JSON.stringify(options || {});
  }

  function readPublicCache(name, options = {}) {
    try {
      if (typeof localStorage === "undefined") return null;
      const key = publicCacheKey(name, options);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || !cached.cachedAt || Date.now() - cached.cachedAt > PUBLIC_CACHE_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return cached.value;
    } catch (error) {
      return null;
    }
  }

  function writePublicCache(name, options, value) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(publicCacheKey(name, options), JSON.stringify({
        cachedAt: Date.now(),
        value
      }));
    } catch (error) {
      // Ignore cache write failures so private browsing/storage quota does not break data loading.
    }
  }

  function clearPublicCache(name) {
    try {
      if (typeof localStorage === "undefined") return;
      const prefix = PUBLIC_CACHE_PREFIX + name + ":";
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(prefix)) localStorage.removeItem(key);
      });
    } catch (error) {
      // Cache invalidation is best-effort.
    }
  }

  function getClient() {
    const bridge = window.OwlStudySupabase;
    if (!bridge || !bridge.client) {
      const reason = bridge && bridge.missingReason
        ? bridge.missingReason
        : "Supabase client is not available.";
      throw new Error(reason + " Please configure supabase-client.js.");
    }
    return bridge.client;
  }

  function clean(payload) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    );
  }

  function asNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function asDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("vi-VN");
  }

  function handle(error, action) {
    if (!error) return;
    throw new Error(action + ": " + error.message);
  }

  function missingTable(error, tableName) {
    if (!error) return false;
    const text = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" ");
    return new RegExp(tableName + "|schema cache|does not exist|could not find|PGRST20", "i").test(text);
  }

  function subjectName(row) {
    return row.subject || (row.subjects && row.subjects.name) || "";
  }

  function examName(row) {
    return row.examName || (row.exams && row.exams.title) || row.title || "";
  }

  function toSubject(row) {
    return {
      id: row.id,
      name: row.name || "",
      title: row.name || "",
      description: row.description || "",
      status: row.status || "inactive",
      createdAt: asDate(row.created_at),
      created_at: row.created_at
    };
  }

  function toExam(row) {
    const name = row.title || row.name || "";
    return {
      id: row.id,
      subjectId: row.subject_id || row.subjectId || "",
      subject_id: row.subject_id || row.subjectId || "",
      subject: subjectName(row),
      title: name,
      name,
      description: row.description || "",
      defaultQuestionCount: row.default_question_count || row.defaultQuestionCount || 0,
      default_question_count: row.default_question_count || row.defaultQuestionCount || 0,
      timeLimitMinutes: row.time_limit_minutes || row.timeLimitMinutes || 0,
      time_limit_minutes: row.time_limit_minutes || row.timeLimitMinutes || 0,
      mode: row.mode || "exam",
      status: row.status || "draft",
      createdAt: asDate(row.created_at),
      created_at: row.created_at
    };
  }

  function toQuestion(row) {
    return {
      id: row.id,
      subjectId: row.subject_id || row.subjectId || "",
      subject_id: row.subject_id || row.subjectId || "",
      subject: subjectName(row),
      examId: row.exam_id || row.examId || "",
      exam_id: row.exam_id || row.examId || "",
      examName: examName(row),
      question: row.question || "",
      A: row.option_a || row.A || "",
      B: row.option_b || row.B || "",
      C: row.option_c || row.C || "",
      D: row.option_d || row.D || "",
      option_a: row.option_a || row.A || "",
      option_b: row.option_b || row.B || "",
      option_c: row.option_c || row.C || "",
      option_d: row.option_d || row.D || "",
      correct: String(row.correct || "A").trim().toUpperCase(),
      explanation: row.explanation || "",
      status: row.status || "active",
      createdAt: asDate(row.created_at),
      created_at: row.created_at
    };
  }

  function toQuestionMeta(row) {
    return {
      id: row.id,
      subjectId: row.subject_id || row.subjectId || "",
      subject_id: row.subject_id || row.subjectId || "",
      examId: row.exam_id || row.examId || "",
      exam_id: row.exam_id || row.examId || "",
      status: row.status || "active",
      createdAt: asDate(row.created_at),
      created_at: row.created_at
    };
  }

  function toMaterial(row) {
    const link = row.drive_url || row.driveUrl || row.link || "";
    return {
      id: row.id,
      subjectId: row.subject_id || row.subjectId || "",
      subject_id: row.subject_id || row.subjectId || "",
      subject: subjectName(row),
      title: row.title || "",
      type: row.type || "Tai lieu",
      driveUrl: link,
      drive_url: link,
      link,
      uploader: row.uploader || "",
      status: row.status || "draft",
      createdAt: asDate(row.created_at),
      created_at: row.created_at,
      date: asDate(row.created_at)
    };
  }

  function toGradeRule(row) {
    return {
      id: row.id,
      subjectId: row.subject_id || row.subjectId || "",
      subject_id: row.subject_id || row.subjectId || "",
      subject: subjectName(row),
      components: row.components_json || row.componentsJson || [],
      components_json: row.components_json || row.componentsJson || [],
      targets: row.targets_json || row.targetsJson || DEFAULT_GRADE_TARGETS,
      targets_json: row.targets_json || row.targetsJson || DEFAULT_GRADE_TARGETS,
      status: row.status || "active",
      createdAt: asDate(row.created_at),
      created_at: row.created_at
    };
  }

  function localGradeRules() {
    try {
      return JSON.parse(localStorage.getItem("owlStudyLocalGradeRules") || "[]");
    } catch (error) {
      return [];
    }
  }

  function writeLocalGradeRules(rows) {
    localStorage.setItem("owlStudyLocalGradeRules", JSON.stringify(rows));
  }

  function getLocalGradeRules(options = {}) {
    return localGradeRules()
      .map(toGradeRule)
      .filter((rule) => (!options.status || rule.status === options.status) && (!options.subjectId || rule.subjectId === options.subjectId));
  }

  function upsertLocalGradeRule(input, id = "") {
    const payload = gradeRulePayload(input);
    const rows = localGradeRules();
    const index = rows.findIndex((row) => (id && row.id === id) || (payload.subject_id && row.subject_id === payload.subject_id));
    const existing = index >= 0 ? rows[index] : {};
    const row = {
      id: existing.id || ("local-grade-" + Date.now()),
      subject_id: payload.subject_id || existing.subject_id || "",
      components_json: payload.components_json || existing.components_json || [],
      targets_json: payload.targets_json || existing.targets_json || DEFAULT_GRADE_TARGETS,
      status: payload.status || existing.status || "active",
      created_at: existing.created_at || new Date().toISOString()
    };
    if (index >= 0) rows[index] = row;
    else rows.unshift(row);
    writeLocalGradeRules(rows);
    return toGradeRule(row);
  }

  function deleteLocalGradeRule(id) {
    writeLocalGradeRules(localGradeRules().filter((row) => row.id !== id));
  }

  function toSiteSetting(row) {
    return {
      key: row.setting_key || row.key || "",
      value: row.value_json || row.value || {},
      value_json: row.value_json || row.value || {},
      updatedAt: asDate(row.updated_at),
      updated_at: row.updated_at
    };
  }

  function parseJson(value, fallback) {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function toGradeRuleFromMaterial(row) {
    const value = parseJson(row.drive_url || row.driveUrl || row.link, {});
    return toGradeRule({
      id: row.id,
      subject_id: value.subjectId || row.subject_id || row.subjectId,
      subjects: row.subjects,
      components_json: value.components || [],
      targets_json: value.targets || DEFAULT_GRADE_TARGETS,
      status: value.status || "active",
      created_at: row.created_at
    });
  }

  function toSiteSettingFromMaterial(row) {
    return {
      key: row.title || "",
      value: parseJson(row.drive_url || row.driveUrl || row.link, {}),
      updatedAt: asDate(row.created_at),
      updated_at: row.created_at
    };
  }

  function subjectPayload(input) {
    return clean({
      name: input.name || input.title,
      description: input.description || input.desc || "",
      status: input.status || "active"
    });
  }

  function examPayload(input) {
    const defaultQuestionCount = input.defaultQuestionCount ?? input.default_question_count;
    const timeLimitMinutes = input.timeLimitMinutes ?? input.time_limit_minutes;
    return clean({
      subject_id: input.subjectId || input.subject_id,
      title: input.title || input.name,
      description: input.description || "",
      default_question_count: defaultQuestionCount === undefined ? 20 : asNumber(defaultQuestionCount, 20),
      time_limit_minutes: timeLimitMinutes === undefined ? 30 : asNumber(timeLimitMinutes, 30),
      mode: input.mode || "exam",
      status: input.status || "draft"
    });
  }

  function questionPayload(input) {
    return clean({
      subject_id: input.subjectId || input.subject_id,
      exam_id: input.examId || input.exam_id,
      question: input.question,
      option_a: input.A || input.a || input.optionA || input.option_a,
      option_b: input.B || input.b || input.optionB || input.option_b,
      option_c: input.C || input.c || input.optionC || input.option_c,
      option_d: input.D || input.d || input.optionD || input.option_d,
      correct: String(input.correct || input.answer || "A").trim().toUpperCase(),
      explanation: input.explanation || "",
      status: input.status || "active"
    });
  }

  function materialPayload(input) {
    return clean({
      subject_id: input.subjectId || input.subject_id,
      title: input.title || input.name,
      type: input.type || "Tai lieu",
      drive_url: input.driveUrl || input.drive_url || input.link || input.url,
      uploader: input.uploader || input.teacher || "",
      status: input.status || "draft"
    });
  }

  function attemptPayload(input) {
    return clean({
      student_name: input.studentName || input.student_name || "",
      student_phone: input.studentPhone || input.student_phone || "",
      exam_id: input.examId || input.exam_id || null,
      subject_id: input.subjectId || input.subject_id || null,
      score: asNumber(input.score, 0),
      total_questions: asNumber(input.totalQuestions || input.total_questions || input.total, 0),
      correct_count: asNumber(input.correctCount || input.correct_count || input.right, 0),
      wrong_count: asNumber(input.wrongCount || input.wrong_count || input.wrong, 0),
      answers_json: input.answersJson || input.answers_json || {}
    });
  }

  function gradeRulePayload(input) {
    return clean({
      subject_id: input.subjectId || input.subject_id,
      components_json: input.components || input.componentsJson || input.components_json || [],
      targets_json: input.targets || input.targetsJson || input.targets_json || DEFAULT_GRADE_TARGETS,
      status: input.status || "active"
    });
  }

  async function getSubjects(options = {}) {
    const cacheOptions = { status: options.status || "" };
    const canUsePublicCache = options.status === "active";
    if (canUsePublicCache) {
      const cached = readPublicCache("subjects", cacheOptions);
      if (Array.isArray(cached)) return cached;
    }
    let query = getClient()
      .from("subjects")
      .select("id, name, description, status, created_at")
      .order("created_at", { ascending: false });
    if (options.status) query = query.eq("status", options.status);
    const { data, error } = await query;
    handle(error, "Load subjects failed");
    const rows = (data || []).map(toSubject);
    if (canUsePublicCache) writePublicCache("subjects", cacheOptions, rows);
    return rows;
  }

  async function createSubject(input) {
    const { data, error } = await getClient()
      .from("subjects")
      .insert(subjectPayload(input))
      .select("*")
      .single();
    handle(error, "Create subject failed");
    clearPublicCache("subjects");
    return toSubject(data);
  }

  async function updateSubject(idOrInput, input = {}) {
    const id = typeof idOrInput === "string" ? idOrInput : idOrInput.id;
    const payload = typeof idOrInput === "string" ? input : idOrInput;
    const { data, error } = await getClient()
      .from("subjects")
      .update(subjectPayload(payload))
      .eq("id", id)
      .select("*")
      .single();
    handle(error, "Update subject failed");
    clearPublicCache("subjects");
    return toSubject(data);
  }

  async function deleteSubject(id) {
    const client = getClient();
    let result = await client.from("questions").delete().eq("subject_id", id);
    handle(result.error, "Delete subject questions failed");
    result = await client.from("materials").delete().eq("subject_id", id);
    handle(result.error, "Delete subject materials failed");
    result = await client.from("exams").delete().eq("subject_id", id);
    handle(result.error, "Delete subject exams failed");
    result = await client.from("subjects").delete().eq("id", id);
    handle(result.error, "Delete subject failed");
    clearPublicCache("subjects");
    clearPublicCache("materials");
  }

  async function getExams(options = {}) {
    let query = getClient()
      .from("exams")
      .select("*, subjects(name)")
      .order("created_at", { ascending: false });
    if (options.status) query = query.eq("status", options.status);
    if (options.subjectId) query = query.eq("subject_id", options.subjectId);
    const { data, error } = await query;
    handle(error, "Load exams failed");
    return (data || []).map(toExam);
  }

  async function createExam(input) {
    const { data, error } = await getClient()
      .from("exams")
      .insert(examPayload(input))
      .select("*, subjects(name)")
      .single();
    handle(error, "Create exam failed");
    return toExam(data);
  }

  async function updateExam(idOrInput, input = {}) {
    const id = typeof idOrInput === "string" ? idOrInput : idOrInput.id;
    const payload = typeof idOrInput === "string" ? input : idOrInput;
    const { data, error } = await getClient()
      .from("exams")
      .update(examPayload(payload))
      .eq("id", id)
      .select("*, subjects(name)")
      .single();
    handle(error, "Update exam failed");
    return toExam(data);
  }

  async function deleteExam(id) {
    const client = getClient();
    let result = await client.from("questions").delete().eq("exam_id", id);
    handle(result.error, "Delete exam questions failed");
    result = await client.from("exams").delete().eq("id", id);
    handle(result.error, "Delete exam failed");
  }

  async function getQuestions(options = {}) {
    let query = getClient()
      .from("questions")
      .select("*, subjects(name), exams(title)")
      .order("created_at", { ascending: false });
    if (options.status) query = query.eq("status", options.status);
    if (options.subjectId) query = query.eq("subject_id", options.subjectId);
    if (options.examId) query = query.eq("exam_id", options.examId);
    const { data, error } = await query;
    handle(error, "Load questions failed");
    return (data || []).map(toQuestion);
  }

  async function getQuestionMeta(options = {}) {
    let query = getClient()
      .from("questions")
      .select("id, subject_id, exam_id, status, created_at")
      .order("created_at", { ascending: false });
    if (options.status) query = query.eq("status", options.status);
    if (options.subjectId) query = query.eq("subject_id", options.subjectId);
    if (options.examId) query = query.eq("exam_id", options.examId);
    const { data, error } = await query;
    handle(error, "Load question metadata failed");
    return (data || []).map(toQuestionMeta);
  }

  async function getQuestionsByExam(examId, options = {}) {
    return getQuestions({ ...options, examId });
  }

  async function createQuestionsBulk(items) {
    const rows = (items || []).map(questionPayload);
    const inserted = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { data, error } = await getClient()
        .from("questions")
        .insert(chunk)
        .select("*, subjects(name), exams(title)");
      handle(error, "Create questions bulk failed");
      inserted.push(...(data || []).map(toQuestion));
    }
    return inserted;
  }

  async function updateQuestion(idOrInput, input = {}) {
    const id = typeof idOrInput === "string" ? idOrInput : idOrInput.id;
    const payload = typeof idOrInput === "string" ? input : idOrInput;
    const { data, error } = await getClient()
      .from("questions")
      .update(questionPayload(payload))
      .eq("id", id)
      .select("*, subjects(name), exams(title)")
      .single();
    handle(error, "Update question failed");
    return toQuestion(data);
  }

  async function deleteQuestion(id) {
    const { error } = await getClient().from("questions").delete().eq("id", id);
    handle(error, "Delete question failed");
  }

  async function getMaterials(options = {}) {
    const cacheOptions = {
      status: options.status || "",
      subjectId: options.subjectId || "",
      includeSystem: !!options.includeSystem
    };
    const canUsePublicCache = options.status === "public" && !options.includeSystem;
    if (canUsePublicCache) {
      const cached = readPublicCache("materials", cacheOptions);
      if (Array.isArray(cached)) return cached;
    }
    let query = getClient()
      .from("materials")
      .select("*, subjects(name)")
      .order("created_at", { ascending: false });
    if (options.status) query = query.eq("status", options.status);
    if (!options.includeSystem) query = query.neq("status", "system");
    if (options.subjectId) query = query.eq("subject_id", options.subjectId);
    const { data, error } = await query;
    handle(error, "Load materials failed");
    const rows = (data || []).map(toMaterial);
    if (canUsePublicCache) writePublicCache("materials", cacheOptions, rows);
    return rows;
  }

  async function getMaterialById(id) {
    const { data, error } = await getClient()
      .from("materials")
      .select("*, subjects(name)")
      .eq("id", id)
      .single();
    handle(error, "Load material failed");
    return toMaterial(data);
  }

  async function createMaterial(input) {
    const { data, error } = await getClient()
      .from("materials")
      .insert(materialPayload(input))
      .select("*, subjects(name)")
      .single();
    handle(error, "Create material failed");
    clearPublicCache("materials");
    return toMaterial(data);
  }

  async function updateMaterial(idOrInput, input = {}) {
    const id = typeof idOrInput === "string" ? idOrInput : idOrInput.id;
    const payload = typeof idOrInput === "string" ? input : idOrInput;
    const { data, error } = await getClient()
      .from("materials")
      .update(materialPayload(payload))
      .eq("id", id)
      .select("*, subjects(name)")
      .single();
    handle(error, "Update material failed");
    clearPublicCache("materials");
    return toMaterial(data);
  }

  async function deleteMaterial(id) {
    const { error } = await getClient().from("materials").delete().eq("id", id);
    handle(error, "Delete material failed");
    clearPublicCache("materials");
  }

  async function saveAttempt(input) {
    const { error } = await getClient()
      .from("attempts")
      .insert(attemptPayload(input));
    handle(error, "Save attempt failed");
    return true;
  }

  async function getGradeRules(options = {}) {
    let query = getClient()
      .from("grade_rules")
      .select("*, subjects(name)")
      .order("created_at", { ascending: false });
    if (options.status) query = query.eq("status", options.status);
    if (options.subjectId) query = query.eq("subject_id", options.subjectId);
    const { data, error } = await query;
    if (missingTable(error, "grade_rules")) {
      console.warn("Grade rules table is not ready yet. Falling back to system materials.", error);
      return getGradeRulesFromMaterials(options);
    }
    handle(error, "Load grade rules failed");
    return (data || []).map(toGradeRule);
  }

  async function getGradeRulesFromMaterials(options = {}) {
    let query = getClient()
      .from("materials")
      .select("*, subjects(name)")
      .eq("type", SYSTEM_GRADE_RULE_TYPE)
      .eq("status", "system")
      .order("created_at", { ascending: false });
    if (options.subjectId) query = query.eq("subject_id", options.subjectId);
    const { data, error } = await query;
    if (error) {
      console.warn("Fallback grade rules in materials are not available. Using local grade rules.", error);
      return getLocalGradeRules(options);
    }
    const materialRules = (data || [])
      .map(toGradeRuleFromMaterial)
      .filter((rule) => !options.status || rule.status === options.status);
    const localRules = getLocalGradeRules(options);
    const seen = new Set(materialRules.map((rule) => rule.subjectId || rule.id));
    return [
      ...materialRules,
      ...localRules.filter((rule) => !seen.has(rule.subjectId || rule.id))
    ];
  }

  async function upsertGradeRuleMaterial(input, id = "") {
    const payload = gradeRulePayload(input);
    const value = {
      subjectId: payload.subject_id,
      components: payload.components_json || [],
      targets: payload.targets_json || DEFAULT_GRADE_TARGETS,
      status: payload.status || "active"
    };
    const row = {
      subject_id: payload.subject_id || null,
      title: "grade_rule:" + (payload.subject_id || "default"),
      type: SYSTEM_GRADE_RULE_TYPE,
      drive_url: JSON.stringify(value),
      uploader: "OwlStudy",
      status: "system"
    };
    const client = getClient();
    let targetId = id;
    if (!targetId) {
      const existing = await client
        .from("materials")
        .select("id")
        .eq("type", SYSTEM_GRADE_RULE_TYPE)
        .eq("title", row.title)
        .limit(1);
      handle(existing.error, "Find fallback grade rule failed");
      targetId = existing.data && existing.data[0] && existing.data[0].id;
    }
    const result = targetId
      ? await client.from("materials").update(row).eq("id", targetId).select("*, subjects(name)").single()
      : await client.from("materials").insert(row).select("*, subjects(name)").single();
    handle(result.error, "Save fallback grade rule failed");
    return toGradeRuleFromMaterial(result.data);
  }

  async function createGradeRule(input) {
    const { data, error } = await getClient()
      .from("grade_rules")
      .insert(gradeRulePayload(input))
      .select("*, subjects(name)")
      .single();
    if (missingTable(error, "grade_rules")) {
      try {
        return await upsertGradeRuleMaterial(input);
      } catch (fallbackError) {
        console.warn("Saving fallback grade rule in materials failed. Using local grade rule.", fallbackError);
        return upsertLocalGradeRule(input);
      }
    }
    handle(error, "Create grade rule failed");
    return toGradeRule(data);
  }

  async function updateGradeRule(idOrInput, input = {}) {
    const id = typeof idOrInput === "string" ? idOrInput : idOrInput.id;
    const payload = typeof idOrInput === "string" ? input : idOrInput;
    const { data, error } = await getClient()
      .from("grade_rules")
      .update(gradeRulePayload(payload))
      .eq("id", id)
      .select("*, subjects(name)")
      .single();
    if (missingTable(error, "grade_rules")) {
      try {
        return await upsertGradeRuleMaterial(payload, id);
      } catch (fallbackError) {
        console.warn("Saving fallback grade rule in materials failed. Using local grade rule.", fallbackError);
        return upsertLocalGradeRule(payload, id);
      }
    }
    handle(error, "Update grade rule failed");
    return toGradeRule(data);
  }

  async function deleteGradeRule(id) {
    const { error } = await getClient().from("grade_rules").delete().eq("id", id);
    if (missingTable(error, "grade_rules")) {
      const fallback = await getClient().from("materials").delete().eq("id", id);
      if (fallback.error) {
        console.warn("Deleting fallback grade rule in materials failed. Removing local grade rule.", fallback.error);
      }
      deleteLocalGradeRule(id);
      return;
    }
    handle(error, "Delete grade rule failed");
  }

  async function getSiteSettings() {
    const cached = readPublicCache("site_settings");
    if (cached && typeof cached === "object") return cached;
    const { data, error } = await getClient()
      .from("site_settings")
      .select("setting_key, value_json, updated_at");
    if (missingTable(error, "site_settings")) {
      console.warn("Site settings table is not ready yet. Falling back to system materials.", error);
      const fallbackSettings = await getSiteSettingsFromMaterials();
      writePublicCache("site_settings", {}, fallbackSettings);
      return fallbackSettings;
    }
    handle(error, "Load site settings failed");
    const settings = (data || []).map(toSiteSetting).reduce((acc, item) => {
      if (item.key) acc[item.key] = item.value || {};
      return acc;
    }, {});
    writePublicCache("site_settings", {}, settings);
    return settings;
  }

  async function getSiteSettingsFromMaterials() {
    const { data, error } = await getClient()
      .from("materials")
      .select("*")
      .eq("type", SYSTEM_SITE_SETTING_TYPE)
      .eq("status", "system");
    handle(error, "Load fallback site settings failed");
    return (data || []).map(toSiteSettingFromMaterial).reduce((acc, item) => {
      if (item.key) acc[item.key] = item.value || {};
      return acc;
    }, {});
  }

  async function upsertSiteSetting(key, value) {
    const { data, error } = await getClient()
      .from("site_settings")
      .upsert({
        setting_key: key,
        value_json: value || {},
        updated_at: new Date().toISOString()
      }, { onConflict: "setting_key" })
      .select("*")
      .single();
    if (missingTable(error, "site_settings")) return upsertSiteSettingMaterial(key, value);
    handle(error, "Save site setting failed");
    clearPublicCache("site_settings");
    return toSiteSetting(data);
  }

  async function upsertSiteSettingMaterial(key, value) {
    const client = getClient();
    const row = {
      subject_id: null,
      title: key,
      type: SYSTEM_SITE_SETTING_TYPE,
      drive_url: JSON.stringify(value || {}),
      uploader: "OwlStudy",
      status: "system"
    };
    const existing = await client
      .from("materials")
      .select("id")
      .eq("type", SYSTEM_SITE_SETTING_TYPE)
      .eq("title", key)
      .limit(1);
    handle(existing.error, "Find fallback site setting failed");
    const id = existing.data && existing.data[0] && existing.data[0].id;
    const result = id
      ? await client.from("materials").update(row).eq("id", id).select("*").single()
      : await client.from("materials").insert(row).select("*").single();
    handle(result.error, "Save fallback site setting failed");
    clearPublicCache("site_settings");
    return toSiteSettingFromMaterial(result.data);
  }

  window.OwlStudyData = {
    getSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
    getExams,
    createExam,
    updateExam,
    deleteExam,
    getQuestions,
    getQuestionMeta,
    getQuestionsByExam,
    createQuestionsBulk,
    updateQuestion,
    deleteQuestion,
    getMaterials,
    getMaterialById,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    saveAttempt,
    getGradeRules,
    createGradeRule,
    updateGradeRule,
    deleteGradeRule,
    getSiteSettings,
    upsertSiteSetting
  };
})();
