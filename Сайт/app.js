const sampleSubscribers = [
  {
    name: "Алексей Демидов",
    address: "ул. Тестовая, д. 1",
    account: "100001",
    phone: "+79991234567",
    balance: 450
  },
  {
    name: "Мария Волкова",
    address: "ул. Учебная, д. 2",
    account: "100002",
    phone: "+79997654321",
    balance: 820
  }
];

let subscribers = JSON.parse(localStorage.getItem("subscribers") || "null")
  || sampleSubscribers;

const selectedSubscribers = new Set();

const list = document.querySelector("#subscriber-list");
const clientSearch = document.querySelector("#client-search");
const clientCount = document.querySelector("#client-count");
const message = document.querySelector("#message");
const reviewSummary = document.querySelector("#review-summary");
const reviewList = document.querySelector("#review-list");
const audioResults = document.querySelector("#audio-results");
const startButton = document.querySelector("#start-demo");
const status = document.querySelector("#status");
const testCallButton = document.querySelector("#test-call");
let generating = false;
const selectAllButton = document.querySelector("#select-all");
const clearSelectionButton = document.querySelector("#clear-selection");
const deletePositiveButton = document.querySelector("#delete-positive");
const clearListButton = document.querySelector("#clear-list");
const exportButton = document.querySelector("#export-list");
const form = document.querySelector("#add-form");
const cancelEditButton = document.querySelector("#cancel-edit");
const submitButton = form.querySelector('button[type="submit"]');
let editingSubscriber = null;
const defaultMessageTemplate =
  "Здравствуйте, {name}! Это компания Трайтэк. Баланс вашего лицевого счёта составляет {balance} рублей. Спасибо!";
const messageTemplate = document.querySelector("#message-template");
messageTemplate.value =
  localStorage.getItem("messageTemplate") || defaultMessageTemplate;

function saveSubscribers() {
  localStorage.setItem("subscribers", JSON.stringify(subscribers));
}

function buildNotificationMessage(subscriber) {
  return messageTemplate.value
    .replace(/\{name\}/g, () => subscriber.name)
    .replace(/\{address\}/g, () => subscriber.address || "Адрес не указан")
    .replace(/\{account\}/g, () => subscriber.account)
    .replace(/\{balance\}/g, () => subscriber.balance);
}
function isValidPhone(phone) {
  const normalized = String(phone || "").trim().replace(/[()\s-]/g, "");
  return /^\+?[1-9]\d{9,14}$/.test(normalized);
}

function pluralizeSubscribers(count) {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return count + " абонентов";
  if (last === 1) return count + " абонент";
  if (last >= 2 && last <= 4) return count + " абонента";
  return count + " абонентов";
}

function renderReview(selected) {
  reviewList.innerHTML = "";

  if (selected.length === 0) {
    reviewSummary.textContent =
      "Выберите клиентов — здесь появятся их телефоны и персональные сообщения.";
    return 0;
  }

  let readyCount = 0;

  selected.forEach((subscriber) => {
    const phoneValid = isValidPhone(subscriber.phone);
    const personalizedText = buildNotificationMessage(subscriber);
    const textValid = personalizedText.trim().length > 0;
    const isReady = phoneValid && textValid;

    if (isReady) readyCount++;

    const card = document.createElement("article");
    card.className = isReady ? "review-card ready" : "review-card needs-fix";

    const title = document.createElement("h4");
    title.textContent =
      subscriber.name + " — лицевой счёт " + subscriber.account;

    const address = document.createElement("p");
    address.className = "review-phone";
    address.textContent = "Адрес: " + (subscriber.address || "Адрес не указан");
    const phone = document.createElement("p");
    phone.className = "review-phone";
    phone.textContent = "Телефон: " + (subscriber.phone || "не указан");

    const text = document.createElement("p");
    text.className = "review-text";
    text.textContent = personalizedText || "Текст уведомления пуст.";

    const result = document.createElement("p");
    result.className = isReady ? "review-result ready-text" : "review-result error-text";
    result.textContent = isReady
      ? "Готово к демонстрации"
      : "Нужно исправить: " +
        [!phoneValid ? "номер телефона" : "", !textValid ? "текст сообщения" : ""]
          .filter(Boolean)
          .join(", ");

    card.append(title, address, phone, text, result);
    reviewList.appendChild(card);
  });

  reviewSummary.textContent =
    "Выбрано " + pluralizeSubscribers(selected.length) +
    ". Готово: " + readyCount + " из " + selected.length + ".";

  return readyCount;
}

function updateSelectionPreview() {
  const selected = [...selectedSubscribers];

  if (selected.length === 0) {
    message.textContent = "Сначала выберите абонента.";
    status.textContent = "";
    renderReview([]);
    startButton.disabled = true;
    testCallButton.disabled = true;
    return;
  }

  if (selected.length === 1) {
    message.textContent = buildNotificationMessage(selected[0]);
  } else {
    message.textContent =
      "Выбрано клиентов: " + selected.length + ". Пример сообщения: " +
      buildNotificationMessage(selected[0]);
  }

  const readyCount = renderReview(selected);
  startButton.disabled = generating || readyCount !== selected.length;
  testCallButton.disabled = generating || selected.length !== 1 || readyCount !== 1;
  status.textContent = "Выбрано абонентов: " + selected.length + ".";
}
messageTemplate.addEventListener("input", () => {
  localStorage.setItem("messageTemplate", messageTemplate.value);
  updateSelectionPreview();
});
function getFilteredSubscribers() {
  const query = clientSearch.value.trim().toLocaleLowerCase("ru-RU");
  const digitsQuery = query.replace(/\D/g, "");

  if (!query) return subscribers;

  return subscribers.filter(subscriber => {
    const searchableText = [
      subscriber.name,
      subscriber.address,
      subscriber.account,
      subscriber.phone,
      subscriber.balance
    ].join(" ").toLocaleLowerCase("ru-RU");

    const phoneDigits = String(subscriber.phone || "").replace(/\D/g, "");
    return searchableText.includes(query) ||
      (digitsQuery.length > 0 && phoneDigits.includes(digitsQuery));
  });
}

function renderSubscribers() {
  list.innerHTML = "";
  const visibleSubscribers = getFilteredSubscribers();

  if (visibleSubscribers.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-list";
    emptyMessage.textContent = subscribers.length === 0
      ? "Список клиентов пуст."
      : "По запросу ничего не найдено.";
    list.appendChild(emptyMessage);
  }

  visibleSubscribers.forEach((subscriber) => {
    const entry = document.createElement("div");
    entry.className = "subscriber-entry";

    const button = document.createElement("button");
    button.type = "button";
    button.className = selectedSubscribers.has(subscriber)
      ? "subscriber selected"
      : "subscriber";
    button.setAttribute("aria-pressed", String(selectedSubscribers.has(subscriber)));

    const name = document.createElement("strong");
    name.className = "subscriber-name";
    name.textContent = subscriber.name;

    const address = document.createElement("span");
    address.className = "subscriber-detail";
    address.textContent = "Адрес: " + (subscriber.address || "Адрес не указан");

    const account = document.createElement("span");
    account.className = "subscriber-detail";
    account.textContent = "Лицевой счёт: " + subscriber.account;

    const balance = document.createElement("span");
    balance.className = "subscriber-detail";
    balance.textContent =
      "Баланс: " + Number(subscriber.balance).toLocaleString("ru-RU") + " ₽";

    const phone = document.createElement("span");
    phone.className = "subscriber-detail";
    phone.textContent = "Телефон: " + (subscriber.phone || "не указан");

    button.append(name, address, account, balance, phone);
    button.addEventListener("click", () => {
      if (selectedSubscribers.has(subscriber)) {
        selectedSubscribers.delete(subscriber);
      } else {
        selectedSubscribers.add(subscriber);
      }

      renderSubscribers();
      updateSelectionPreview();
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-subscriber";
    editButton.textContent = "Изменить";
    editButton.setAttribute("aria-label", "Редактировать данные: " + subscriber.name);
    editButton.addEventListener("click", () => {
      editingSubscriber = subscriber;
      form.elements.name.value = subscriber.name || "";
      form.elements.address.value = subscriber.address || "";
      form.elements.account.value = subscriber.account || "";
      form.elements.phone.value = subscriber.phone || "";
      form.elements.balance.value = subscriber.balance ?? "";
      submitButton.textContent = "Сохранить изменения";
      cancelEditButton.hidden = false;
      status.textContent = "Редактирование: " + subscriber.name;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      form.elements.name.focus();
    });

    entry.append(button, editButton);
    list.appendChild(entry);
  });

  clientCount.textContent =
    "Показано: " + visibleSubscribers.length + " из " + subscribers.length +
    ". Выбрано: " + selectedSubscribers.size + ".";

  selectAllButton.disabled =
    visibleSubscribers.length === 0 ||
    visibleSubscribers.every(subscriber => selectedSubscribers.has(subscriber));
  clearSelectionButton.disabled = selectedSubscribers.size === 0;
  deletePositiveButton.disabled =
    !subscribers.some(subscriber => Number(subscriber.balance) > 0);
  clearListButton.disabled = subscribers.length === 0;
  exportButton.disabled = subscribers.length === 0;
}
function resetEditMode() {
  editingSubscriber = null;
  form.reset();
  submitButton.textContent = "Добавить в список";
  cancelEditButton.hidden = true;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const updatedSubscriber = {
    name: data.get("name").trim(),
    address: data.get("address").trim(),
    account: data.get("account").trim(),
    phone: data.get("phone").trim(),
    balance: Number(data.get("balance"))
  };

  if (editingSubscriber) {
    Object.assign(editingSubscriber, updatedSubscriber);
    resetEditMode();
    saveSubscribers();
    renderSubscribers();
    updateSelectionPreview();
    status.textContent = "Данные абонента обновлены.";
    return;
  }

  subscribers.push(updatedSubscriber);
  saveSubscribers();
  renderSubscribers();
  resetEditMode();
  status.textContent = "Абонент добавлен в список.";
});

cancelEditButton.addEventListener("click", () => {
  resetEditMode();
  status.textContent = "Редактирование отменено.";
});
function parseCsvLine(line, delimiter) {
  const fields = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const character = line[i];

    if (character === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === delimiter && !insideQuotes) {
      fields.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  fields.push(value.trim());
  return fields;
}

const csvInput = document.querySelector("#csv-file");

csvInput.addEventListener("change", async () => {
  const file = csvInput.files[0];
  if (!file) return;

  try {
    const content = (await file.text()).replace(/^\uFEFF/, "").trim();
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      status.textContent = "В файле нет строк с абонентами.";
      return;
    }

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = parseCsvLine(lines[0], delimiter)
      .map(header => header.toLowerCase().replace(/ё/g, "е"));

    const findColumn = (...names) =>
      headers.findIndex(header => names.includes(header));

    const nameColumn = findColumn("name", "фио");
    const addressColumn = findColumn("address", "адрес");
    const accountColumn = findColumn("account", "лицевой счет");
    const phoneColumn = findColumn("phone", "телефон");
    const balanceColumn = findColumn("balance", "баланс");

    if ([nameColumn, accountColumn, phoneColumn, balanceColumn].includes(-1)) {
      status.textContent =
        "Не найдены нужные столбцы: name, account, phone, balance.";
      return;
    }

    const imported = [];
    let skipped = 0;

    for (const line of lines.slice(1)) {
      const row = parseCsvLine(line, delimiter);
      const balanceText = (row[balanceColumn] || "").replace(",", ".");
      const balance = Number(balanceText);

      const subscriber = {
        name: row[nameColumn] || "",
        address: addressColumn >= 0 ? row[addressColumn] || "" : "",
        account: row[accountColumn] || "",
        phone: row[phoneColumn] || "",
        balance
      };

      if (
        !subscriber.name ||
        !subscriber.account ||
        !subscriber.phone ||
        !Number.isFinite(balance)
      ) {
        skipped++;
        continue;
      }

      imported.push(subscriber);
    }

    subscribers.push(...imported);
    saveSubscribers();
    renderSubscribers();

    status.textContent = imported.length
      ? `Добавлено абонентов: ${imported.length}. Пропущено строк: ${skipped}.`
      : "Не удалось загрузить абонентов. Проверь данные в файле.";

    csvInput.value = "";
  } catch (error) {
    status.textContent = "Не удалось прочитать файл CSV.";
  }
});
clientSearch.addEventListener("input", () => {
  renderSubscribers();
});
selectAllButton.addEventListener("click", () => {
  getFilteredSubscribers().forEach(subscriber => selectedSubscribers.add(subscriber));
  renderSubscribers();
  updateSelectionPreview();
});

clearSelectionButton.addEventListener("click", () => {
  selectedSubscribers.clear();
  renderSubscribers();
  updateSelectionPreview();
});
deletePositiveButton.addEventListener("click", () => {
  const toDelete = subscribers.filter(
    subscriber => Number(subscriber.balance) > 0
  );

  if (toDelete.length === 0) {
    status.textContent = "Клиентов с положительным балансом не найдено.";
    return;
  }

  const confirmed = window.confirm(
    "Удалить " + toDelete.length +
    " абонентов с положительным балансом? Это действие нельзя отменить."
  );

  if (!confirmed) return;

  const deletedSubscribers = new Set(toDelete);
  subscribers = subscribers.filter(subscriber => !deletedSubscribers.has(subscriber));
  toDelete.forEach(subscriber => selectedSubscribers.delete(subscriber));

  saveSubscribers();
  renderSubscribers();
  updateSelectionPreview();
  status.textContent = "Удалено клиентов с положительным балансом: " + toDelete.length + ".";
});
clearListButton.addEventListener("click", () => {
  if (subscribers.length === 0) {
    status.textContent = "Список уже пуст.";
    return;
  }

  const count = subscribers.length;
  const confirmed = window.confirm(
    "Очистить весь список и удалить " + count +
    " записей из сохранённых данных браузера? Это действие нельзя отменить."
  );

  if (!confirmed) return;

  subscribers = [];
  selectedSubscribers.clear();
  saveSubscribers();
  renderSubscribers();
  updateSelectionPreview();
  status.textContent = "Список очищен. Удалено записей: " + count + ".";
});
exportButton.addEventListener("click", () => {
  if (subscribers.length === 0) return;

  const escapeCsv = value =>
    '"' + String(value ?? "").replace(/"/g, '""') + '"';

  const rows = [
    ["ФИО", "Адрес", "Лицевой счёт", "Телефон", "Баланс"],
    ...subscribers.map(subscriber => [
      subscriber.name,
      subscriber.address || "",
      subscriber.account,
      subscriber.phone,
      subscriber.balance
    ])
  ];

  const csv = "\uFEFF" +
    rows.map(row => row.map(escapeCsv).join(";")).join("\r\n");
  const file = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "abonenty-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  status.textContent = "Выгружена вся база: " + subscribers.length + " записей.";
});
startButton.addEventListener("click", async () => {
  if (generating) return;
  const selected = [...selectedSubscribers];
  const invalid = selected.filter(
    subscriber =>
      !isValidPhone(subscriber.phone) ||
      !buildNotificationMessage(subscriber).trim()
  );

  if (selected.length === 0 || invalid.length > 0) {
    status.textContent = "Сначала исправьте ошибки в проверке получателей.";
    return;
  }

  generating = true;
  updateSelectionPreview();
  audioResults.innerHTML = "";
  let completed = 0;

  try {
    for (const subscriber of selected) {
      status.textContent =
        `Создаю аудио ${completed + 1} из ${selected.length}…`;

      const response = await fetch("http://127.0.0.1:18020/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: buildNotificationMessage(subscriber)
        })
      });

      if (!response.ok) {
        throw new Error(`TTS API вернул HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const item = document.createElement("p");
      const link = document.createElement("a");
      const safeAccount = String(subscriber.account).replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );

      item.append(document.createTextNode(
        `${subscriber.name} — счёт ${subscriber.account}: `
      ));

      link.href = audioUrl;
      link.download = `abonent-${safeAccount}.wav`;
      link.textContent = "Скачать WAV";
      item.appendChild(link);
      audioResults.appendChild(item);

      completed++;
    }

    status.textContent =
      `Готово. Сформировано аудиофайлов: ${completed}. Звонки не выполнялись.`;
  } catch (error) {
    status.textContent = "Не удалось создать аудио: " + error.message;
  } finally {
    generating = false;
    const resultText = status.textContent;
    updateSelectionPreview();
    status.textContent = resultText;
  }
});
renderSubscribers();


// Одиночная имитация использует ту же модель и текущий персональный текст.
// Телефон отображается как данные абонента; подключение к телефонии отсутствует.
const callDialog = document.querySelector("#call-dialog");
const callClient = document.querySelector("#call-client");
const callState = document.querySelector("#call-state");
const callAudio = document.querySelector("#call-audio");
const answerCall = document.querySelector("#answer-call");
const endCall = document.querySelector("#end-call");
let callRequest = null;
let callAudioUrl = null;

function closeTestCall() {
  if (callRequest) callRequest.abort();
  callRequest = null;
  callAudio.pause();
  callAudio.removeAttribute("src");
  callAudio.load();
  if (callAudioUrl) URL.revokeObjectURL(callAudioUrl);
  callAudioUrl = null;
  callDialog.close();
  generating = false;
  updateSelectionPreview();
  status.textContent = "Тестовый звонок завершён. Реальный вызов не выполнялся.";
}

endCall.addEventListener("click", closeTestCall);
callDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeTestCall();
});
answerCall.addEventListener("click", async () => {
  answerCall.disabled = true;
  callAudio.hidden = false;
  callState.textContent = "Соединение установлено — воспроизведение уведомления.";
  endCall.textContent = "Завершить звонок";
  try {
    await callAudio.play();
  } catch {
    callState.textContent = "Нажмите воспроизведение на аудиоплеере.";
  }
});
callAudio.addEventListener("ended", () => {
  callState.textContent = "Уведомление воспроизведено. Тестовый звонок завершён.";
  endCall.textContent = "Закрыть";
});

testCallButton.addEventListener("click", async () => {
  const selected = [...selectedSubscribers];
  if (generating || selected.length !== 1 || !isValidPhone(selected[0].phone)) return;
  const text = buildNotificationMessage(selected[0]);
  if (!text.trim() || text.length > 1500) {
    status.textContent = "Для теста нужен текст от 1 до 1500 символов.";
    return;
  }
  generating = true;
  updateSelectionPreview();
  const controller = new AbortController();
  callRequest = controller;
  callClient.textContent = selected[0].name + " · " + selected[0].phone;
  callState.textContent = "Подготовка голосового уведомления на сервере…";
  answerCall.disabled = true;
  callAudio.hidden = true;
  endCall.textContent = "Отменить";
  callDialog.showModal();
  try {
    const response = await fetch("http://127.0.0.1:18020/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("TTS API вернул HTTP " + response.status);
    const blob = await response.blob();
    if (controller.signal.aborted) return;
    callAudioUrl = URL.createObjectURL(blob);
    callAudio.src = callAudioUrl;
    callState.textContent = "Имитируется входящий звонок. Нажмите «Ответить».";
    answerCall.disabled = false;
    endCall.textContent = "Отклонить";
  } catch (error) {
    if (controller.signal.aborted) return;
    callState.textContent = "Не удалось подготовить аудио: " + error.message + ". Проверьте SSH-туннель и TTS API.";
    endCall.textContent = "Закрыть";
  }
});
