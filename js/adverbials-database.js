(function () {
    'use strict';

    const locale = document.documentElement.lang === 'ru' ? 'ru' : 'en';
    const messages = {
        ru: {
            loadError: 'Не удалось загрузить базу данных. Обновите страницу, чтобы повторить попытку.',
            missing: 'Нет данных', sourceError: 'Ошибка в источнике',
            stats: (entries, nouns) => `Записей в базе: ${entries}; существительных: ${nouns}.`,
            count: (entries, nouns) => `Результаты — записей: ${entries}; существительных: ${nouns}`,
            page: (page, total, first, last) => `Страница ${page} из ${total}; записи ${first}–${last}`,
            empty: 'По заданным условиям ничего не найдено.',
            chooseColumns: 'Выберите хотя бы один столбец.',
            initial: 'Настройте поиск и нажмите «Показать».',
            pending: 'Настройки изменены. Нажмите «Показать», чтобы применить их. Экспорт использует последние показанные результаты.',
            applied: 'Настройки применены.',
            searchOptions: label => `Найти значение: ${label}`,
            clear: 'Снять выбор',
            exportError: 'Экспорт недоступен: библиотека XLSX не загрузилась. Обновите страницу или скачайте исходную базу по ссылке выше.',
            sheet: 'Адвербиалы',
        },
        en: {
            loadError: 'Could not load the database. Reload the page to try again.',
            missing: 'No data', sourceError: 'Source error',
            stats: (entries, nouns) => `Database: ${entries} entries; ${nouns} nouns.`,
            count: (entries, nouns) => `Results: ${entries} entries; ${nouns} nouns`,
            page: (page, total, first, last) => `Page ${page} of ${total}; entries ${first}–${last}`,
            empty: 'No entries match these conditions.',
            chooseColumns: 'Select at least one column.',
            initial: 'Set your search options and click Show.',
            pending: 'Controls have changed. Click Show to apply them. Export uses the last displayed results.',
            applied: 'Controls applied.',
            searchOptions: label => `Find a value: ${label}`,
            clear: 'Clear selection',
            exportError: 'Export is unavailable because the XLSX library did not load. Reload the page or download the source database above.',
            sheet: 'Adverbials',
        },
    };
    const text = messages[locale];
    const get = id => document.getElementById(`adv-${id}`);
    const normalize = value => value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const label = field => field.label[locale];
    const PAGE_SIZE = 50;
    // Blank and error keys cannot collide with a source value.
    const key = value => !value ? 'blank:' : value.state === 'error' ? 'error:' : `value:${normalize(value.text)}`;
    let database;
    let displayed = null;
    let page = 0;
    let searchIndex;

    function validate(payload) {
        const fail = () => { throw new Error('Invalid adverbials dataset'); };
        if (payload.schema_version !== 1 || !Array.isArray(payload.fields) || !payload.fields.length ||
            !Array.isArray(payload.entries) || !payload.entries.length) fail();
        const ids = new Set();
        for (const field of payload.fields) {
            if (!/^[a-z][a-z0-9_]*$/.test(field.id) || ids.has(field.id) ||
                !field.label || typeof field.label.ru !== 'string' || typeof field.label.en !== 'string' ||
                typeof field.default !== 'boolean' || ![null, 'core', 'advanced'].includes(field.filter)) fail();
            ids.add(field.id);
        }
        if (!ids.has('noun') || !ids.has('construction') || !ids.has('origin')) fail();
        const rows = new Set();
        for (const entry of payload.entries) {
            if (!Number.isInteger(entry.source_row) || rows.has(entry.source_row) || !entry.values || !entry.values.noun?.text) fail();
            rows.add(entry.source_row);
            for (const [id, value] of Object.entries(entry.values)) {
                if (!ids.has(id) || !value || typeof value.text !== 'string' ||
                    (value.html !== undefined && typeof value.html !== 'string') ||
                    (value.state !== undefined && value.state !== 'error')) fail();
            }
        }
    }

    function showError(message) {
        get('error').textContent = message;
        get('error').hidden = false;
    }

    function pending() {
        get('pending').textContent = displayed ? text.pending : text.initial;
    }

    function checkbox(container, name, value, title, checked = false) {
        const wrapper = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = name;
        input.value = value;
        input.checked = checked;
        input.setAttribute('data-affects-results', '');
        wrapper.append(input, document.createTextNode(title));
        container.append(wrapper);
        return wrapper;
    }

    function createFilter(field) {
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = label(field);
        const search = document.createElement('input');
        search.type = 'search';
        search.setAttribute('aria-label', text.searchOptions(label(field)));
        const options = document.createElement('div');
        options.className = 'adv-options';
        options.id = `adv-options-${field.id}`;
        search.setAttribute('aria-controls', options.id);
        const values = new Map();
        for (const entry of database.entries) {
            const value = entry.values[field.id];
            const optionKey = key(value);
            if (!values.has(optionKey)) values.set(optionKey, !value ? text.missing : value.state === 'error' ? text.sourceError : value.text.trim());
        }
        const collator = new Intl.Collator('ru');
        const sorted = [...values].sort((a, b) => {
            if (a[0] === 'blank:') return 1;
            if (b[0] === 'blank:') return -1;
            return collator.compare(a[1], b[1]);
        });
        for (const [value, title] of sorted) checkbox(options, `filter-${field.id}`, value, title);
        search.addEventListener('input', () => {
            const query = normalize(search.value);
            for (const option of options.children) option.hidden = !normalize(option.textContent).includes(query);
        });
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.textContent = text.clear;
        clear.setAttribute('aria-label', `${text.clear}: ${label(field)}`);
        clear.addEventListener('click', () => {
            for (const input of options.querySelectorAll('input')) input.checked = false;
            pending();
        });
        fieldset.append(legend, search, options, clear);
        get(field.filter === 'core' ? 'filters' : 'advanced-filters').append(fieldset);
    }

    function checked(name) {
        return [...get('controls').querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
    }

    function show(event) {
        event.preventDefault();
        const columns = new Set(checked('column'));
        if (!columns.size) {
            showError(text.chooseColumns);
            return;
        }
        const filters = database.fields.filter(field => field.filter).map(field => [field.id, new Set(checked(`filter-${field.id}`))]);
        const query = normalize(get('query').value);
        const entries = database.entries.filter((entry, index) =>
            (!query || searchIndex[index].includes(query)) &&
            filters.every(([id, values]) => !values.size || values.has(key(entry.values[id])))
        );
        displayed = {entries, fields: database.fields.filter(field => columns.has(field.id))};
        page = 0;
        get('error').hidden = true;
        get('pending').textContent = text.applied;
        render();
    }

    function formatted(cell, markup) {
        // Allow only the formatting emitted by the read-only builder.
        const template = document.createElement('template');
        template.innerHTML = markup;
        function clean(parent) {
            for (const node of [...parent.childNodes]) {
                if (node.nodeType === 3) continue;
                if (node.nodeType !== 1) { node.remove(); continue; }
                if (!['STRONG', 'EM', 'SPAN', 'SUP', 'SUB', 'BR'].includes(node.tagName)) {
                    node.replaceWith(document.createTextNode(node.textContent));
                    continue;
                }
                const color = node.tagName === 'SPAN' ? node.getAttribute('style') : null;
                for (const attribute of [...node.attributes]) node.removeAttribute(attribute.name);
                if (color && /^color: #[0-9a-f]{6}$/i.test(color)) node.setAttribute('style', color);
                clean(node);
            }
        }
        clean(template.content);
        cell.append(template.content);
    }

    function render() {
        const {entries, fields} = displayed;
        const start = page * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, entries.length);
        get('head').replaceChildren();
        get('body').replaceChildren();
        const heading = document.createElement('tr');
        for (const field of fields) {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = label(field);
            heading.append(th);
        }
        get('head').append(heading);
        const fragment = document.createDocumentFragment();
        for (const entry of entries.slice(start, end)) {
            const tr = document.createElement('tr');
            tr.dataset.sourceRow = entry.source_row;
            for (const field of fields) {
                const td = document.createElement('td');
                td.dataset.field = field.id;
                const value = entry.values[field.id];
                if (!value) {
                    td.textContent = text.missing;
                    td.className = 'adv-missing';
                } else if (value.state === 'error') {
                    td.textContent = text.sourceError;
                    td.className = 'adv-source-error';
                } else if (value.html) formatted(td, value.html);
                else td.textContent = value.text;
                tr.append(td);
            }
            fragment.append(tr);
        }
        get('body').append(fragment);
        const nouns = new Set(entries.map(entry => normalize(entry.values.noun.text))).size;
        get('count').textContent = text.count(entries.length, nouns);
        get('caption').textContent = get('count').textContent;
        get('results').hidden = false;
        get('empty').textContent = text.empty;
        get('empty').hidden = entries.length !== 0;
        get('table-wrapper').hidden = entries.length === 0;
        get('page').textContent = entries.length ? text.page(page + 1, Math.ceil(entries.length / PAGE_SIZE), start + 1, end) : '';
        get('previous').disabled = page === 0;
        get('next').disabled = end >= entries.length;
        get('export').disabled = entries.length === 0;
        get('table-wrapper').scrollTop = 0;
    }

    function exportDisplayed() {
        if (!displayed?.entries.length) return;
        if (!window.XLSX) { showError(text.exportError); return; }
        try {
            const {entries, fields} = displayed;
            const rows = [fields.map(label), ...entries.map(entry => fields.map(field => {
                const value = entry.values[field.id];
                return !value ? '' : value.state === 'error' ? text.sourceError : value.text;
            }))];
            const worksheet = window.XLSX.utils.aoa_to_sheet(rows);
            worksheet['!cols'] = fields.map(() => ({wch: 30}));
            const workbook = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(workbook, worksheet, text.sheet);
            window.XLSX.writeFile(workbook, `adverbials_${locale}.xlsx`);
            get('error').hidden = true;
        } catch (error) {
            console.error(error);
            showError(text.exportError);
        }
    }

    async function init() {
        try {
            const response = await fetch('data/adverbials.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            database = await response.json();
            validate(database);
            searchIndex = database.entries.map(entry => Object.values(entry.values).map(value => normalize(value.text)).join('\n'));
            for (const field of database.fields) {
                checkbox(get('columns'), 'column', field.id, label(field), field.default);
                if (field.filter) createFilter(field);
            }
            get('stats').textContent = text.stats(database.entries.length, new Set(database.entries.map(entry => normalize(entry.values.noun.text))).size);
            get('stats').hidden = false;
            get('controls').hidden = false;
            get('status').textContent = '';
            pending();
            get('controls').addEventListener('submit', show);
            get('controls').addEventListener('input', event => {
                if (event.target.hasAttribute('data-affects-results')) pending();
            });
            for (const state of ['all', 'none']) get(`columns-${state}`).addEventListener('click', () => {
                for (const input of get('columns').querySelectorAll('input')) input.checked = state === 'all';
                pending();
            });
            get('reset').addEventListener('click', () => {
                get('controls').reset();
                // Programmatically created checkboxes need explicit defaults.
                for (const input of get('columns').querySelectorAll('input')) input.checked = database.fields.find(field => field.id === input.value).default;
                for (const option of get('controls').querySelectorAll('.adv-options label')) option.hidden = false;
                pending();
            });
            get('export').addEventListener('click', exportDisplayed);
            get('previous').addEventListener('click', () => { if (displayed && page > 0) { page--; render(); } });
            get('next').addEventListener('click', () => { if (displayed && (page + 1) * PAGE_SIZE < displayed.entries.length) { page++; render(); } });
        } catch (error) {
            console.error(error);
            get('status').textContent = '';
            get('controls').hidden = true;
            showError(text.loadError);
        }
    }

    init();
}());
