# Contributing

**English** · [Русский](#участие-в-разработке)

Thanks for helping make UI less generic. The most valuable contributions are:

1. **False positives**: a real, intentional design that `slopscan` flags. Use the
   [false positive form](https://github.com/stonexy1/uislop/issues/new?template=false_positive.yml).
2. **Missed patterns**: AI-template UI that scores low. Use the
   [rule request form](https://github.com/stonexy1/uislop/issues/new?template=rule_request.yml).
3. **Bug reports**: crashes, wrong line numbers, config not applied. Use the
   [bug report form](https://github.com/stonexy1/uislop/issues/new?template=bug_report.yml).

Always include a minimal snippet (a few lines of TSX, CSS or HTML) and the output of `npx @stonexy/slopscan <file> --json`.

## Development

Building and testing need Node.js 22.18 or newer.

```sh
npm install
npm run typecheck
npm run build
npm test
```

Project layout:

| Path | Purpose |
|---|---|
| `src/parse/` | File parsing: Babel AST for TSX/JSX, masked scans for CSS and HTML, class tokenizer, ignore directives |
| `src/rules/` | One module per category; phrase, palette and emoji data in `src/rules/data/` |
| `src/scorer.ts` | Slop Score math |
| `src/report.ts`, `src/prompt-builder.ts`, `src/badge.ts` | Terminal report, fix prompt, SVG badge |
| `src/meta.ts` | Names and commands; the only place to change them |
| `skill/SKILL.md` | The agent skill installed by `init` |
| `tests/fixtures/dirty`, `tests/fixtures/clean` | Reference projects: the dirty one must score 61+, the clean one must have 0 findings |

## Adding or changing a rule

1. Add the detection to the category module in `src/rules/` with a stable ID `category/rule-name`.
2. Add positive and negative tests in `tests/rules/`. Every false positive fixed needs a negative test.
3. Document the rule in both `README.md` and `README.ru.md`, and in `skill/SKILL.md`. `tests/docs-consistency.test.ts`
   fails if a rule is missing from the docs.
4. Keep `tests/fixtures/clean` at 0 findings. Do not change the scoring constants in `src/scorer.ts` to make a test pass.

## Pull requests

- One topic per pull request, with tests.
- `npm run typecheck`, `npm run build` and `npm test` must pass; CI runs them on Node.js 22 and the built CLI on Node.js 20.
- The CLI output stays plain: no emoji, no banners, aligned columns.
- Commit messages: imperative mood, for example `Add rule for gradient text`.

---

## Участие в разработке

[English](#contributing) · **Русский**

Спасибо, что помогаете сделать интерфейсы менее шаблонными. Самое ценное:

1. **Ложные срабатывания**: реальный, осознанный дизайн, на который ругается `slopscan`. Форма:
   [false positive](https://github.com/stonexy1/uislop/issues/new?template=false_positive.yml).
2. **Пропущенные паттерны**: шаблонный ИИ-интерфейс, который получает низкую оценку. Форма:
   [rule request](https://github.com/stonexy1/uislop/issues/new?template=rule_request.yml).
3. **Ошибки**: падения, неверные номера строк, неприменённый конфиг. Форма:
   [bug report](https://github.com/stonexy1/uislop/issues/new?template=bug_report.yml).

Всегда прикладывайте минимальный фрагмент (несколько строк TSX, CSS или HTML) и вывод `npx @stonexy/slopscan <file> --json`.
Issue и pull request можно писать на русском.

## Разработка

Для сборки и тестов нужен Node.js 22.18 или новее.

```sh
npm install
npm run typecheck
npm run build
npm test
```

Структура проекта:

| Путь | Назначение |
|---|---|
| `src/parse/` | Разбор файлов: AST Babel для TSX/JSX, маскированный разбор CSS и HTML, токенизатор классов, комментарии-исключения |
| `src/rules/` | По модулю на категорию; фразы, палитры и эмодзи в `src/rules/data/` |
| `src/scorer.ts` | Математика Slop Score |
| `src/report.ts`, `src/prompt-builder.ts`, `src/badge.ts` | Отчёт в терминале, fix-промпт, SVG-бейдж |
| `src/meta.ts` | Имена и команды; менять их можно только здесь |
| `skill/SKILL.md` | Агентский скилл, который ставит `init` |
| `tests/fixtures/dirty`, `tests/fixtures/clean` | Эталонные проекты: «грязный» должен набирать 61+, у «чистого» должно быть 0 находок |

## Как добавить или изменить правило

1. Добавьте проверку в модуль категории в `src/rules/` со стабильным ID `category/rule-name`.
2. Добавьте положительные и отрицательные тесты в `tests/rules/`. Каждое исправленное ложное срабатывание требует
   отрицательного теста.
3. Опишите правило в `README.md`, `README.ru.md` и `skill/SKILL.md`. Тест `tests/docs-consistency.test.ts` упадёт,
   если правило не задокументировано.
4. У `tests/fixtures/clean` должно оставаться 0 находок. Не меняйте константы скоринга в `src/scorer.ts`, чтобы
   пройти тест.

## Pull request

- Одна тема на pull request, с тестами.
- `npm run typecheck`, `npm run build` и `npm test` должны проходить; CI запускает их на Node.js 22, а собранный CLI
  проверяет на Node.js 20.
- Вывод CLI остаётся простым: без эмодзи и баннеров, с выровненными колонками.
- Сообщения коммитов на английском, в повелительном наклонении, например `Add rule for gradient text`.
