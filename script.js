/**
 * ============================================
 * script.js  —  페이지가 “움직이게” 하는 파일
 * ============================================
 * - HTML은 정적인 문서이고, JavaScript(JS)는 클릭 같은 이벤트에 반응해
 *   화면을 바꾸거나 입력값을 검사합니다.
 * - 이 파일은 “한 페이지 안에서 단계만 바꿔 보여 주는 방식”으로 구현했습니다.
 *   (여러 html 파일을 만들지 않아도 됩니다.)
 *
 * 중요 변경:
 * - 사전 서베이 문항은 HTML 고정 문장을 쓰지 않고, 아래 배열을 기준으로 "매번 다시 렌더링"합니다.
 * - 그래서 문항이 중복되거나 과거 문항이 남는 문제를 원천 차단할 수 있습니다.
 */

/** 현재 보여 줄 단계 번호 (0 = 시작 화면, 5 = 완료) */
let currentStep = 0;

/** 사용자가 고른 과정: "1" 또는 "2" 또는 아직 없으면 null */
let selectedCourse = null;
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzw5RRYWcZ96vxB_khRumNJRn5-AA1dHxfG8iz9pW4jKnFudIFfcyA0J1r4gxSc-bb_ag/exec";
/** 9개 차수의 표시 이름 (나중에 날짜로 바꾸고 싶으면 이 배열만 수정하면 됩니다) */
/** 업무효율화 과정 차수 (9개) */
const SLOT_LABELS_1 = [
  "1차 (5/26)",
  "2차 (5/27)",
  "3차 (5/28)",
  "4차 (6/15)",
  "5차 (6/16)",
  "6차 (6/17)",
  "7차 (7/13)",
  "8차 (7/14)",
  "9차 (7/15)",
];

/** 업무자동화 과정 차수 (3개) */
const SLOT_LABELS_2 = [
  "1차 (5/21-5/22)",
  "2차 (6/18-6/19)",
  "3차 (7/9-7/10)",
];


/**
 * 과정별 사전 서베이 문항 (정확히 5개씩만 사용)
 * - 여기 배열 외에는 사전 서베이 문항을 만들지 않습니다.
 */
const SURVEY_QUESTIONS = {
  "1": [
    "AI를 활용하여 보고서, 자료 등 업무 결과물을 작성해본 경험이 있다",
    "프롬프트를 단순 질문이 아닌 지시문 형태로 활용할 수 있다",
    "AI 활용 결과를 수정·보완하여 업무에 적용해본 경험이 있다",
    "반복 업무에 AI를 활용하여 효율을 높여본 경험이 있다",
    "본인의 업무 프로세스를 개선하고자 하는 의지가 있다",
  ],
  "2": [
    "본인의 반복업무를 최소 1개 이상 명확히 설명할 수 있다",
    "업무를 단계별로 나누어 설명할 수 있다",
    "AI를 활용해 업무를 개선해본 경험이 있다",
    "반복 업무를 자동화하거나 구조적으로 개선해보고자 한다",
    "새로운 도구(n8n 등)를 활용한 실습에 부담이 없다",
  ],
};

/** DOM이 준비된 뒤에 실행되도록 DOMContentLoaded에 연결 */
document.addEventListener("DOMContentLoaded", () => {
  initSlotSelects();
  bindSlotChangeDelegation();
  bindNavButtons();
  bindStartAndRestart();
  bindSurveyDelegation();
  bindModalClose();
  bindCourseVisual();
  // 시작 시에도 문항 컨테이너를 안전하게 초기화해 둡니다.
  renderSurveyQuestions();
  updateUIStep();
});

/**
 * 차수 선택용 <select> 세 개에 옵션을 채웁니다.
 * - 빈 칸(선택 안 함) + 9개 차수
 */
function initSlotSelects() {
  const labels = selectedCourse === "2"
    ? SLOT_LABELS_2
    : SLOT_LABELS_1;

  const ids = ["slotFirst", "slotSecond", "slotThird"];

  ids.forEach((id) => {
    const sel = document.getElementById(id);
    sel.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "선택하세요";
    sel.appendChild(placeholder);

    labels.forEach((label, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx + 1);
      opt.textContent = label;
      sel.appendChild(opt);
    });
  });
}

/**
 * 차수 <select>는 초기화 때마다 DOM이 새로 만들어지므로,
 * 부모 요소에 change 리스너를 한 번만 달아 두는 방식이 안전합니다.
 */
function bindSlotChangeDelegation() {
  const wrap = document.querySelector(".slot-grid");
  if (!wrap || wrap.dataset.bound === "1") return;
  wrap.dataset.bound = "1";
  wrap.addEventListener("change", () => {
    syncSlotSelectOptions();
    clearSlotError();
  });
}

/**
 * 세 개의 차수 선택에서 서로 겹치지 않게 옵션을 동기화합니다.
 * - 이미 다른 칸에서 고른 차수는 남은 칸의 목록에서 숨깁니다.
 */
function syncSlotSelectOptions() {
  const s1 = document.getElementById("slotFirst").value;
  const s2 = document.getElementById("slotSecond").value;
  const s3 = document.getElementById("slotThird").value;
  const chosen = new Set([s1, s2, s3].filter(Boolean));

  const labels = selectedCourse === "2"
    ? SLOT_LABELS_2
    : SLOT_LABELS_1;

  ["slotFirst", "slotSecond", "slotThird"].forEach((id) => {
    const sel = document.getElementById(id);
    const current = sel.value;

    sel.innerHTML = "";

    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "선택하세요";
    sel.appendChild(ph);

    labels.forEach((label, idx) => {
      const val = String(idx + 1);
      const takenElsewhere = chosen.has(val) && val !== current;
      if (takenElsewhere) return;

      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      sel.appendChild(opt);
    });

    const exists = Array.from(sel.options).some((o) => o.value === current);
    sel.value = exists ? current : "";
  });
}

/** “신청 시작하기”, “처음으로” 버튼 */
function bindStartAndRestart() {
  document.getElementById("btnStart").addEventListener("click", () => {
    goToStep(1);
  });
  document.getElementById("btnRestart").addEventListener("click", () => {
    resetWizard();
  });
}

/** 이전 / 다음 버튼: data-nav 속성으로 구분 */
function bindNavButtons() {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-nav");
      const context = btn.getAttribute("data-context");
      if (dir === "prev") {
        goToStep(currentStep - 1);
      } else if (dir === "next") {
        handleNext(context);
      }
    });
  });
}

/**
 * 다음 버튼: 단계별로 검사 후 이동
 * @param {string|null} context - 어떤 폼에서 왔는지 표시용 문자열
 */
function handleNext(context) {
  if (context === "personal") {
    if (!validatePersonal()) return;
    goToStep(2);
    return;
  }

  if (context === "course") {
    if (!validateCourse()) return;
    initSlotSelects();
    prepareSurveyUI();
    goToStep(3);
    return;
  }

  if (context === "survey") {
    const count = countSurveyChecked();

    if (selectedCourse === "1") {
      if (count < 3) {
        openHardModal("3개 이상 해당할 경우 본 과정 신청이 가능합니다.");
        return;
      }
    }

    if (selectedCourse === "2") {
      if (count < 5) {
        openHardModal("모든 항목을 충족하며 자동화 주제를 제출해야 본 과정 신청이 가능합니다.");
        return;
      }
      if (!validateCourse2Details()) return;
    }

    goToStep(4);
    syncSlotSelectOptions();
    return;
  }

  if (context === "slots") {
    if (!validateSlots()) return;

    submitToGoogleSheet()
      .then(() => {
        renderSummary();
        goToStep(5);
      })
      .catch((error) => {
        console.error(error);

        if (error.code === "DUPLICATE_EMAIL") {
          const incoming = error.debug?.incomingEmail || "-";
          const row = error.debug?.matchedRow || "-";
          const matched = error.debug?.matchedValue || "-";

          showInfoModal(
            `중복 이메일로 판정되었습니다.\n\n입력 이메일: ${incoming}\n시트 행: ${row}\n시트 값: ${matched}`
          );
        } else {
          showInfoModal("신청 저장 중 오류가 발생했습니다. 다시 시도해 주세요.");
        }
      });

    return;
  }

  goToStep(currentStep + 1);
}

/** 개인정보 필수 항목 검사 */
function validatePersonal() {
  const fields = [
    { id: "company", err: "err-company", msg: "회사명을 입력해 주세요." },
    { id: "email", err: "err-email", msg: "이메일을 입력해 주세요." },
    { id: "fullname", err: "err-fullname", msg: "이름을 입력해 주세요." },
    { id: "job", err: "err-job", msg: "직무를 입력해 주세요." },
    { id: "reason", err: "err-reason", msg: "신청 사유를 입력해 주세요." },
  ];
  let ok = true;
  fields.forEach(({ id, err, msg }) => {
    const input = document.getElementById(id);
    const errEl = document.getElementById(err);
    const value = (input.value || "").trim();
    if (!value) {
      errEl.textContent = msg;
      ok = false;
    } else if (id === "email" && !input.checkValidity()) {
      errEl.textContent = "올바른 이메일 형식인지 확인해 주세요.";
      ok = false;
    } else {
      errEl.textContent = "";
    }
  });
  return ok;
}

/** 과정 라디오 선택 검사 */
function validateCourse() {
  const picked = document.querySelector('input[name="course"]:checked');
  const err = document.getElementById("err-course");
  if (!picked) {
    err.textContent = "과정을 하나 선택해 주세요.";
    return false;
  }
  err.textContent = "";
  selectedCourse = picked.value; // "1" 또는 "2"
  return true;
}

/**
 * 사전 서베이 문항 렌더링 (완전 재작성 핵심)
 * - 컨테이너를 먼저 비우고 정확히 5개만 다시 생성합니다.
 * - 문항 중복/잔존이 절대 발생하지 않게 보장합니다.
 */
function renderSurveyQuestions() {
  const box1 = document.getElementById("surveyCourse1");
  const box2 = document.getElementById("surveyCourse2");
  if (!box1 || !box2) return;

  box1.innerHTML = "";
  box2.innerHTML = "";

  SURVEY_QUESTIONS["1"].forEach((text, idx) => {
    box1.appendChild(createSurveyRow("survey1", `s1${idx + 1}`, text));
  });
  SURVEY_QUESTIONS["2"].forEach((text, idx) => {
    box2.appendChild(createSurveyRow("survey2", `s2${idx + 1}`, text));
  });
}

/**
 * 체크박스 한 줄 생성 함수
 * @param {string} name - input name (survey1/survey2)
 * @param {string} value - input value
 * @param {string} text - 라벨 텍스트
 */
function createSurveyRow(name, value, text) {
  const label = document.createElement("label");
  label.className = "check-row";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.value = value;

  label.appendChild(input);
  label.appendChild(document.createTextNode(` ${text}`));
  return label;
}

/** 선택된 과정에 맞게 사전 서베이 UI 표시 */
function prepareSurveyUI() {
  const box1 = document.getElementById("surveyCourse1");
  const box2 = document.getElementById("surveyCourse2");
  const intro = document.getElementById("surveyIntro");
  const details = document.getElementById("surveyCourse2Details");
  const workRepeat = document.getElementById("workRepeat");
  const workSteps = document.getElementById("workSteps");
  const workAutomation = document.getElementById("workAutomation");

  // 핵심: 매번 문항을 새로 렌더링하여 "기존 문항 잔존" 문제를 제거
  renderSurveyQuestions();

  if (selectedCourse === "1") {
    box1.hidden = false;
    box2.hidden = true;
    details.hidden = true;
  
    box1.style.display = "block";
    box2.style.display = "none";
    details.style.display = "none";
  
    intro.textContent = "다음 항목 중 3개 이상 해당할 경우 참여 가능합니다.";
  } else {
    box1.hidden = true;
    box2.hidden = false;
    details.hidden = false;
  
    box1.style.display = "none";
    box2.style.display = "block";
    details.style.display = "block";
  
    intro.textContent = "다음 항목을 모두 충족하고 자동화 주제를 제출하는 경우 참여 가능합니다.";
  }

  // 과정 변경 시 체크/텍스트/에러 초기화
  box1.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = false));
  box2.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = false));
  if (workRepeat) workRepeat.value = "";
  if (workSteps) workSteps.value = "";
  if (workAutomation) workAutomation.value = "";
  clearCourse2DetailErrors();

  updateSurveyHint();
}

/** 현재 과정에 맞는 체크 개수 세기 */
function countSurveyChecked() {
  const name = selectedCourse === "1" ? "survey1" : "survey2";
  return document.querySelectorAll(`input[name="${name}"]:checked`).length;
}

function updateSurveyHint() {
  const hint = document.getElementById("surveyCountHint");
  const n = countSurveyChecked();
  if (selectedCourse === "2") {
    hint.textContent = `현재 ${n}/5 선택됨 · 5개 모두 필요`;
  } else {
    hint.textContent = `현재 ${n}개 선택됨 · 3개 이상 필요`;
  }
}

function bindSurveyDelegation() {
  const panel = document.getElementById("panel-survey");
  if (!panel || panel.dataset.bound === "1") return;
  panel.dataset.bound = "1";
  panel.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('input[type="checkbox"]')) {
      updateSurveyHint();
    }
  });
}

/**
 * 업무자동화 과정 전용 주관식 3개 필수 검사
 * - 하나라도 비어 있으면 다음 단계로 못 넘어가게 막고 안내를 보여줍니다.
 */
function validateCourse2Details() {
  const workRepeat = document.getElementById("workRepeat");
  const workSteps = document.getElementById("workSteps");
  const workAutomation = document.getElementById("workAutomation");

  // 안전장치
  if (!workRepeat || !workSteps || !workAutomation) return true;

  const a = (workRepeat.value || "").trim();
  const b = (workSteps.value || "").trim();
  const c = (workAutomation.value || "").trim();

  let ok = true;
  if (!a) {
    document.getElementById("err-workRepeat").textContent = "이 항목을 작성해 주세요.";
    ok = false;
  }
  if (!b) {
    document.getElementById("err-workSteps").textContent = "이 항목을 작성해 주세요.";
    ok = false;
  }
  if (!c) {
    document.getElementById("err-workAutomation").textContent = "이 항목을 작성해 주세요.";
    ok = false;
  }

  if (!ok) {
    openHardModal("모든 항목을 충족하며 자동화 주제를 제출해야 본 과정 신청이 가능합니다.");
  }
  return ok;
}

function clearCourse2DetailErrors() {
  const ids = ["err-workRepeat", "err-workSteps", "err-workAutomation"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

/** 차수: 세 칸 모두 선택 + 서로 다른지 검사 */
function validateSlots() {
  const a = document.getElementById("slotFirst").value;
  const b = document.getElementById("slotSecond").value;
  const c = document.getElementById("slotThird").value;
  const err = document.getElementById("err-slots");

  if (!a) {
    showInfoModal("1지망은 반드시 선택해 주세요.");
    return false;
  }

  const picked = [a, b, c].filter(Boolean);
  if (new Set(picked).size !== picked.length) {
    showInfoModal("같은 차수는 중복해서 선택할 수 없습니다. 서로 다른 차수를 골라 주세요.");
    return false;
  }

  if (err) err.textContent = "";
  return true;
}
  


/** 완료 화면에 입력 요약 출력 */
function renderSummary() {
  const company = document.getElementById("company").value.trim();
  const email = document.getElementById("email").value.trim();
  const fullname = document.getElementById("fullname").value.trim();
  const job = document.getElementById("job").value.trim();
  const reason = document.getElementById("reason").value.trim();
  const courseText = selectedCourse === "1" ? "업무효율화 과정" : "업무자동화 과정";

  const surveyLabels = getCheckedSurveyLabels();
  const s1 = labelForSlotValue(document.getElementById("slotFirst").value);
  const s2 = labelForSlotValue(document.getElementById("slotSecond").value);
  const s3 = labelForSlotValue(document.getElementById("slotThird").value);

  const text =
    `회사명: ${company}\n` +
    `이메일: ${email}\n` +
    `이름: ${fullname}\n` +
    `직무: ${job}\n` +
    `신청 사유: ${reason}\n\n` +
    `선택 과정: ${courseText}\n` +
    `사전 서베이 선택: ${surveyLabels.join(", ")}\n\n` +
    `1지망: ${s1}\n2지망: ${s2}\n3지망: ${s3}`;

  document.getElementById("summaryBox").textContent = text;
}

function labelForSlotValue(val) {
  const labels = selectedCourse === "2"
    ? SLOT_LABELS_2
    : SLOT_LABELS_1;

  const i = Number(val);
  if (!i || i < 1 || i > labels.length) return "-";
  return labels[i - 1];
}

function getCheckedSurveyLabels() {
  const name = selectedCourse === "1" ? "survey1" : "survey2";
  const labels = [];
  document.querySelectorAll(`input[name="${name}"]:checked`).forEach((input) => {
    const row = input.closest(".check-row");
    const clone = row.cloneNode(true);
    clone.querySelector("input")?.remove();
    labels.push(clone.textContent.replace(/\s+/g, " ").trim());
  });
  return labels;
}

/** 단계 이동: 화면 전환 + 진행 표시 업데이트 */
function goToStep(step) {
  const clamped = Math.max(0, Math.min(5, step));
  currentStep = clamped;

  document.querySelectorAll(".panel").forEach((panel) => {
    const panelStep = Number(panel.dataset.step);
    const active = panelStep === currentStep;
    panel.classList.toggle("panel--active", active);
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  });

  updateProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** 상단 단계 칩 + 프로그레스 바 너비 갱신 */
function updateProgress() {
  const steps = document.querySelectorAll(".progress-step");
  steps.forEach((li) => {
    const idx = Number(li.dataset.progressIndex);
    li.classList.remove("is-active", "is-done");
    if (idx < currentStep) li.classList.add("is-done");
    if (idx === currentStep) li.classList.add("is-active");
  });

  const fill = document.getElementById("progressBarFill");
  const pct = (currentStep / 5) * 100;
  fill.style.width = `${pct}%`;
}

/** 처음 화면으로 초기화 */
function resetWizard() {
  currentStep = 0;
  selectedCourse = null;
  document.getElementById("formPersonal").reset();
  document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  document.getElementById("err-course").textContent = "";
  document.querySelectorAll('input[name="course"]').forEach((r) => (r.checked = false));
  document.querySelectorAll(".choice-card").forEach((c) => c.classList.remove("is-selected"));

  // 사전 서베이 초기화
  renderSurveyQuestions();
  document.getElementById("surveyCourse1").hidden = true;
  document.getElementById("surveyCourse2").hidden = true;
  document.querySelectorAll('#surveyCourse1 input, #surveyCourse2 input').forEach((c) => (c.checked = false));

  // 업무자동화 과정 전용 주관식 초기화
  const details = document.getElementById("surveyCourse2Details");
  if (details) details.hidden = true;
  const intro = document.getElementById("surveyIntro");
  if (intro) intro.textContent = "안내 문구를 불러오는 중입니다...";
  const workRepeat = document.getElementById("workRepeat");
  const workSteps = document.getElementById("workSteps");
  const workAutomation = document.getElementById("workAutomation");
  if (workRepeat) workRepeat.value = "";
  if (workSteps) workSteps.value = "";
  if (workAutomation) workAutomation.value = "";
  clearCourse2DetailErrors();

  // 차수 초기화
  ["slotFirst", "slotSecond", "slotThird"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  initSlotSelects();
  updateSurveyHint();
  goToStep(0);
}

/** “수강이 어렵습니다” 전용 모달 */
function openHardModal(customMessage) {
  const modal = document.getElementById("modalHard");
  const body = modal.querySelector(".modal-body");
  if (body) {
    body.textContent =
      customMessage || "수강 조건을 충족하지 못했습니다. 안내 문구를 확인한 뒤 다시 시도해 주세요.";
  }
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

/** 일반 안내 모달 */
function showInfoModal(message) {
  const modal = document.getElementById("modalInfo");
  document.getElementById("modalInfoBody").textContent = message;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModals() {
  document.querySelectorAll(".modal").forEach((m) => {
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
  });
}

/** 모달 닫기: 배경 클릭 또는 확인 버튼 */
function bindModalClose() {
  document.querySelectorAll("[data-close-modal]").forEach((node) => {
    node.addEventListener("click", closeModals);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
  });
}

/** 라디오 카드 시각적 선택 상태(구형 브라우저 대비) */
function bindCourseVisual() {
  document.querySelectorAll('input[name="course"]').forEach((input) => {
    input.addEventListener("change", () => {
      document.querySelectorAll(".choice-card").forEach((card) => {
        card.classList.toggle("is-selected", card.contains(input) && input.checked);
      });
    });
  });
}

/** 최초 로딩 시 한 번: 진행 표시 맞추기 */
function updateUIStep() {
  goToStep(0);
}
async function submitToGoogleSheet() {
  const company = document.getElementById("company").value.trim();
  const email = document.getElementById("email").value.trim();
  const fullname = document.getElementById("fullname").value.trim();
  const job = document.getElementById("job").value.trim();
  const reason = document.getElementById("reason").value.trim();

  const course = selectedCourse === "1" ? "업무효율화 과정" : "업무자동화 과정";
  const surveyLabels = getCheckedSurveyLabels();

  const workRepeat = document.getElementById("workRepeat")?.value.trim() || "";
  const workSteps = document.getElementById("workSteps")?.value.trim() || "";
  const workAutomation = document.getElementById("workAutomation")?.value.trim() || "";

  const slotFirst = labelForSlotValue(document.getElementById("slotFirst").value);
  const slotSecond = labelForSlotValue(document.getElementById("slotSecond").value);
  const slotThird = labelForSlotValue(document.getElementById("slotThird").value);

  const payload = {
    company,
    email,
    fullname,
    job,
    reason,
    course,
    surveyLabels,
    workRepeat,
    workSteps,
    workAutomation,
    slotFirst,
    slotSecond,
    slotThird
  };

  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

const result = await response.json();

if (!result.ok) {
  const error = new Error(result.error || "시트 저장에 실패했습니다.");
  error.code = result.code || "";
  error.debug = result.debug || null;
  throw error;
}
}
