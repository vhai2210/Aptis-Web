function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    reading: {
      part1: readReadingPart1(ss),
      part2: readReadingOrderPart(ss, "reading_part2", "part2"),
      part3: readReadingOrderPart(ss, "reading_part3", "part3"),
      part4: readReadingPersonPart(ss, "reading_part4"),
      part5: readReadingHeadingPart(ss, "reading_part5")
    },
    listening: {
      part1: readListeningPart(ss, ["listening_part1", "listening part1", "listening p1"], "part1"),
      part2: readListeningPart(ss, ["listening_part2", "listening part2", "listening p2"], "part2"),
      part3: readListeningPart(ss, ["listening_part3", "listening part3", "listening p3"], "part3"),
      part4: readListeningPart(ss, ["listening_part4", "listening part4", "listening p4"], "part4")
    },
    updatedAt: new Date().toISOString()
  };

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   LISTENING CONNECTOR CHO student.html
   student.html tự nhóm các dòng bằng set_id/group_id/exam_id
   ========================================================= */

function getSheetByNames(ss, names) {
  for (let i = 0; i < names.length; i++) {
    const sheet = ss.getSheetByName(names[i]);
    if (sheet) return sheet;
  }
  return null;
}

function readSheetRowsByNames(ss, names) {
  const sheet = getSheetByNames(ss, names);
  if (!sheet) return [];

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h || "").trim());

  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((key, index) => {
      if (key) obj[key] = row[index];
    });
    return obj;
  }).filter(row => {
    const joined = Object.values(row).join("").trim();
    if (!joined) return false;

    const status = String(
      row.status ||
      row.trang_thai ||
      row["trạng thái"] ||
      row["Trạng thái"] ||
      "public"
    ).toLowerCase().trim();

    return status === "" ||
      status === "public" ||
      status === "cong khai" ||
      status === "công khai";
  });
}

function pickAny(row, keys) {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

function joinOptionsFromRow(row, partKey) {
  const direct = pickAny(row, [
    "options",
    "Options",
    "choice",
    "choices",
    "option_list",
    "danh_sach_dap_an",
    "danh sách đáp án",
    "lua_chon",
    "lựa chọn"
  ]);

  if (direct) {
    return String(direct)
      .split("||")
      .map(x => String(x).trim())
      .filter(Boolean)
      .join("||");
  }

  const a = pickAny(row, ["A", "a", "option_a", "đáp án 1", "dap an 1", "Answer 1"]);
  const b = pickAny(row, ["B", "b", "option_b", "đáp án 2", "dap an 2", "Answer 2"]);
  const c = pickAny(row, ["C", "c", "option_c", "đáp án 3", "dap an 3", "Answer 3"]);
  const d = pickAny(row, ["D", "d", "option_d", "đáp án 4", "dap an 4", "Answer 4"]);

  const arr = [a, b, c, d].map(x => String(x || "").trim()).filter(Boolean);

  if (arr.length) return arr.join("||");

  if (partKey === "part3") return "Man||Woman||Both";

  return "";
}

function readListeningPart(ss, sheetNames, partKey) {
  const rows = readSheetRowsByNames(ss, sheetNames);

  return rows.map((row, index) => {
    const defaultSetId = "listening-" + partKey + "-001";

    const setId = String(pickAny(row, [
      "set_id",
      "setId",
      "exam_id",
      "examId",
      "group_id",
      "groupId",
      "mã đề",
      "ma de",
      "Mã đề"
    ]) || defaultSetId).trim();

    const audioUrl = pickAny(row, [
      "audio_url",
      "audioUrl",
      "audio",
      "Link Drive",
      "link drive",
      "link_drive",
      "link audio",
      "Link audio",
      "mp3",
      "url"
    ]);

    const questionText = pickAny(row, [
      "question",
      "Question",
      "prompt",
      "statement",
      "text",
      "đề bài",
      "de bai",
      "câu hỏi",
      "cau hoi"
    ]);

    const speakerLabel = pickAny(row, [
      "speaker",
      "speaker_label",
      "label",
      "person",
      "người nói",
      "nguoi noi"
    ]);

    const answer = pickAny(row, [
      "answer",
      "correct",
      "correct_answer",
      "đáp án đúng",
      "dap an dung",
      "Đáp án đúng"
    ]);

    const transcript = pickAny(row, [
      "transcript",
      "voice",
      "dữ liệu voice",
      "du lieu voice",
      "script",
      "lời thoại",
      "loi thoai"
    ]);

    const title = pickAny(row, [
      "title",
      "set_title",
      "ten_de",
      "tên đề",
      "Tên đề"
    ]) || ("Listening " + partKey.replace("part", "Part "));

    const instruction = pickAny(row, [
      "instruction",
      "instructions",
      "hướng dẫn",
      "huong dan"
    ]) || defaultListeningInstruction(partKey);

    return {
      id: pickAny(row, ["id", "ID", "STT", "stt"]) || (partKey + "-" + (index + 1)),
      STT: pickAny(row, ["STT", "stt"]) || (index + 1),

      set_id: setId,
      set_title: title,
      title: title,
      instruction: instruction,

      audio_url: audioUrl,
      audioUrl: audioUrl,
      "Link Drive": audioUrl,

      question: questionText,
      prompt: questionText,
      statement: questionText,

      speaker: speakerLabel,
      label: speakerLabel,

      options: joinOptionsFromRow(row, partKey),

      A: pickAny(row, ["A", "a", "option_a", "đáp án 1", "dap an 1", "Answer 1"]),
      B: pickAny(row, ["B", "b", "option_b", "đáp án 2", "dap an 2", "Answer 2"]),
      C: pickAny(row, ["C", "c", "option_c", "đáp án 3", "dap an 3", "Answer 3"]),
      D: pickAny(row, ["D", "d", "option_d", "đáp án 4", "dap an 4", "Answer 4"]),

      answer: answer,
      correct: answer,
      correct_answer: answer,
      "đáp án đúng": answer,

      transcript: transcript,
      voice: transcript,
      "dữ liệu voice": transcript,

      status: "public"
    };
  });
}

function defaultListeningInstruction(partKey) {
  if (partKey === "part1") return "Listen and choose the correct answer.";
  if (partKey === "part2") return "Listen to the speakers and choose the correct answer for each speaker.";
  if (partKey === "part3") return "Listen and decide who expresses each opinion.";
  if (partKey === "part4") return "Listen and choose the correct answers.";
  return "Listen and choose the correct answer.";
}
