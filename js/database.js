(function () {
    'use strict';

    const DATA_URL = 'data/questionnaire.json';
    let database = null;
    let currentData = [];

    const translations = {
        ru: {
            questionText: 'Текст вопроса',
            number: '№',
            group: 'Группа',
            groupLabel: (group) => {
                const name = group.group_name ? `: ${group.group_name}` : '';
                return `Группа ${group.group_number}${name} (${group.question_count} вопросов)`;
            },
            stats: (stats) =>
                `Всего вопросов: ${stats.total_questions} | ` +
                `Полностью заполненных: ${stats.complete_responses} | ` +
                `Доступно языков: ${stats.available_languages.length}`,
            selectGroup: 'Пожалуйста, выберите хотя бы одну группу вопросов',
            selectLanguage: 'Пожалуйста, выберите хотя бы один язык',
            loadError: 'Ошибка загрузки данных: ',
            invalidData: 'Некорректный формат файла базы данных',
            noExportData: 'Нет данных для экспорта. Пожалуйста, сначала загрузите данные.',
            exportUnavailable: 'Экспорт в Excel недоступен: библиотека XLSX не загрузилась.',
            sheetName: 'Данные анкеты',
            exportFile: 'questionnaire_data.xlsx',
            languages: {
                russian: 'Русский',
                polish: 'Польский',
                muira: 'Муиринский',
                westcircassian: 'Адыгейский',
                danish: 'Датский',
                nganasan: 'Нганасанский',
                bulgarian: 'Болгарский',
                greben: 'Гребенский диалект болгарского',
                nanai: 'Нанайский',
                nor_nakhichevan: 'Нор-нахичеванский диалект западноармянского',
                udmurt: 'Удмуртский',
                mountmari: 'Горномарийский',
                icari: 'Ицаринский',
                macedonian: 'Македонский',
                norwegian: 'Норвежский',
                kumyk: 'Кумыкский',
                northernkhanty: 'Севернохантыйский',
                ulch: 'Ульчский',
                abaza: 'Абазинский',
                turkish: 'Турецкий',
                karata: 'Каратинский',
                sirhi: 'Сирхинский'
            }
        },
        en: {
            questionText: 'Question Text',
            number: '№',
            group: 'Group',
            groupLabel: (group) => {
                const name = group.group_name ? `: ${group.group_name}` : '';
                return `Group ${group.group_number}${name} (${group.question_count} questions)`;
            },
            stats: (stats) =>
                `Total questions: ${stats.total_questions} | ` +
                `Complete responses: ${stats.complete_responses} | ` +
                `Available languages: ${stats.available_languages.length}`,
            selectGroup: 'Please select at least one question group',
            selectLanguage: 'Please select at least one language',
            loadError: 'Error loading data: ',
            invalidData: 'Invalid database file format',
            noExportData: 'No data to export. Please load data first.',
            exportUnavailable: 'Excel export is unavailable because the XLSX library did not load.',
            sheetName: 'Questionnaire Data',
            exportFile: 'questionnaire_data.xlsx',
            languages: {
                russian: 'Russian',
                polish: 'Polish',
                muira: 'Muira',
                westcircassian: 'West Circassian',
                danish: 'Danish',
                nganasan: 'Nganasan',
                bulgarian: 'Bulgarian',
                greben: 'Greben dialect of Bulgarian',
                nanai: 'Nanai',
                nor_nakhichevan: 'Nor-Nakhichevan dialect of West Armenian',
                udmurt: 'Udmurt',
                mountmari: 'Mountain Mari',
                icari: 'Icari',
                macedonian: 'Macedonian',
                norwegian: 'Norwegian',
                kumyk: 'Kumyk',
                northernkhanty: 'Northern Khanty',
                ulch: 'Ulch',
                abaza: 'Abaza',
                turkish: 'Turkish',
                karata: 'Karata',
                sirhi: 'Sirhi'
            }
        }
    };

    const locale = document.documentElement.lang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    const text = translations[locale];

    function element(id) {
        return document.getElementById(id);
    }

    function validateDatabase(payload) {
        if (
            !payload ||
            payload.schema_version !== 1 ||
            !payload.stats ||
            !Array.isArray(payload.groups) ||
            !Array.isArray(payload.languages) ||
            !Array.isArray(payload.questions)
        ) {
            throw new Error(text.invalidData);
        }

        const languageKeys = payload.languages.map((language) => language.language_key);
        if (
            languageKeys.length !== payload.stats.available_languages.length ||
            languageKeys.some((key) => !/^[a-z][a-z0-9_]*$/.test(key)) ||
            payload.questions.some((question) =>
                !question.question_number ||
                !question.group_number ||
                languageKeys.some((key) => !Object.prototype.hasOwnProperty.call(question, key))
            )
        ) {
            throw new Error(text.invalidData);
        }
    }

    async function init() {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }
            const payload = await response.json();
            validateDatabase(payload);
            database = payload;

            element('statsText').textContent = text.stats(payload.stats);
            element('statsSection').style.display = 'block';
            createGroupCheckboxes();
            createLanguageCheckboxes();
            element('loadingMessage').style.display = 'none';
            element('controls').style.display = 'block';
        } catch (error) {
            element('loadingMessage').style.display = 'none';
            showError(text.loadError + error.message);
        }
    }

    function getLanguageName(key) {
        if (key === 'question_text') {
            return text.questionText;
        }
        const metadata = database.languages.find((language) => language.language_key === key);
        return text.languages[key] || metadata?.display_name || key;
    }

    function appendCheckbox(container, prefix, value, labelText, checked) {
        const wrapper = document.createElement('div');
        wrapper.className = 'checkbox-item';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `${prefix}_${value}`;
        input.value = value;
        input.checked = checked;

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = labelText;

        wrapper.append(input, label);
        container.appendChild(wrapper);
    }

    function createGroupCheckboxes() {
        const container = element('groupCheckboxes');
        container.replaceChildren();
        [...database.groups]
            .sort((a, b) => Number(a.group_number) - Number(b.group_number))
            .forEach((group) =>
                appendCheckbox(
                    container,
                    'group',
                    group.group_number,
                    text.groupLabel(group),
                    false
                )
            );
    }

    function createLanguageCheckboxes() {
        const container = element('languageCheckboxes');
        container.replaceChildren();
        appendCheckbox(container, 'lang', 'question_text', text.questionText, true);
        database.languages.forEach((language) =>
            appendCheckbox(
                container,
                'lang',
                language.language_key,
                getLanguageName(language.language_key),
                false
            )
        );
    }

    function checkedValues(prefix) {
        return Array.from(document.querySelectorAll(`[id^="${prefix}_"]:checked`))
            .map((checkbox) => checkbox.value);
    }

    function selectAllGroups() {
        document.querySelectorAll('[id^="group_"]').forEach((checkbox) => {
            checkbox.checked = true;
        });
    }

    function selectAllLanguages() {
        document.querySelectorAll('[id^="lang_"]').forEach((checkbox) => {
            checkbox.checked = true;
        });
    }

    function selectAll() {
        selectAllGroups();
        selectAllLanguages();
    }

    function clearSelection() {
        document.querySelectorAll('[id^="group_"], [id^="lang_"]').forEach((checkbox) => {
            checkbox.checked = false;
        });
    }

    function loadData() {
        const selectedGroups = checkedValues('group');
        const selectedLanguages = checkedValues('lang');

        if (selectedGroups.length === 0) {
            showError(text.selectGroup);
            return;
        }
        if (selectedLanguages.length === 0) {
            showError(text.selectLanguage);
            return;
        }

        hideError();
        const selectedGroupSet = new Set(selectedGroups);
        currentData = database.questions.filter((question) =>
            selectedGroupSet.has(question.group_number)
        );
        displayTable(currentData, selectedLanguages);
        element('resultsSection').style.display = 'block';
    }

    function appendTextCell(row, tagName, value) {
        const cell = document.createElement(tagName);
        cell.textContent = value;
        row.appendChild(cell);
    }

    function displayTable(data, selectedLanguages) {
        const header = element('tableHeader');
        const body = element('tableBody');
        header.replaceChildren();
        body.replaceChildren();

        const headerRow = document.createElement('tr');
        appendTextCell(headerRow, 'th', text.number);
        appendTextCell(headerRow, 'th', text.group);
        selectedLanguages.forEach((language) =>
            appendTextCell(headerRow, 'th', getLanguageName(language))
        );
        header.appendChild(headerRow);

        data.forEach((question) => {
            const row = document.createElement('tr');
            appendTextCell(row, 'td', question.question_number);
            appendTextCell(row, 'td', question.group_number);
            selectedLanguages.forEach((language) => {
                const cell = document.createElement('td');
                cell.innerHTML = question[language] || '';
                row.appendChild(cell);
            });
            body.appendChild(row);
        });

        element('resultCount').textContent = data.length;
    }

    function showError(message) {
        const error = element('errorMessage');
        error.textContent = message;
        error.style.display = 'block';
    }

    function hideError() {
        element('errorMessage').style.display = 'none';
    }

    function htmlToText(value) {
        const container = document.createElement('div');
        container.innerHTML = value;
        return container.textContent || container.innerText || '';
    }

    function exportToExcel() {
        if (currentData.length === 0) {
            window.alert(text.noExportData);
            return;
        }
        if (!window.XLSX) {
            window.alert(text.exportUnavailable);
            return;
        }

        const selectedLanguages = checkedValues('lang');
        const rows = currentData.map((question) => [
            question.question_number,
            question.group_number,
            ...selectedLanguages.map((language) => htmlToText(question[language] || ''))
        ]);
        const worksheet = XLSX.utils.aoa_to_sheet([
            [text.number, text.group, ...selectedLanguages.map(getLanguageName)],
            ...rows
        ]);
        worksheet['!cols'] = [
            { wch: 10 },
            { wch: 10 },
            ...selectedLanguages.map(() => ({ wch: 50 }))
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, text.sheetName);
        XLSX.writeFile(workbook, text.exportFile);
    }

    window.loadData = loadData;
    window.selectAll = selectAll;
    window.selectAllGroups = selectAllGroups;
    window.selectAllLanguages = selectAllLanguages;
    window.clearSelection = clearSelection;
    window.exportToExcel = exportToExcel;
    window.addEventListener('DOMContentLoaded', init);
})();
