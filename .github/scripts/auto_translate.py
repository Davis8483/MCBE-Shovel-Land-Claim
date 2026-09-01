import re
import os
import asyncio
from googletrans import Translator, LANGUAGES
import yaml

# Determine project folder (two levels up from this script)
PROJECT_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
# load settings from yaml file
with open(os.path.join(os.path.dirname(__file__), 'auto_translate_config.yaml'), 'r', encoding='utf-8') as f:
    settings = yaml.safe_load(f)

SOURCE_FILE = os.path.join(PROJECT_FOLDER, settings['source'])
CACHED_FILE = os.path.join(PROJECT_FOLDER, f'.github/scripts/cache/{settings['source'].split("/")[-1]}')
DESTINATION_FOLDER = os.path.join(PROJECT_FOLDER, settings['destination'])
if not DESTINATION_FOLDER.endswith('/'):
    DESTINATION_FOLDER += '/'

# Ensure language codes are strings (safe if YAML contains numbers or other types)
TARGET_LANGS_AUTO = [str(l) for l in settings.get('target_langs_auto', [])]
TARGET_LANGS_MANUAL = [str(l) for l in settings.get('target_langs_manual', [])]


# Split value into chunks: formatting codes and text
def split_value_chunks(text):
    # Regex for formatting codes: §., %s, \n
    pattern = r'§.|%s|\\n'
    chunks = re.split(pattern, text)
    matches = re.findall(pattern, text)
    result = []
    for i, chunk in enumerate(chunks):
        if chunk:
            result.append({'type': 'text', 'value': chunk})
        if i < len(matches):
            result.append({'type': 'format', 'value': matches[i]})
    return result

# Reassemble chunks after translation
def reassemble_chunks(chunks, translated_texts):
    out = []
    text_idx = 0
    for chunk in chunks:
        if chunk['type'] == 'text':
            out.append(translated_texts[text_idx])
            text_idx += 1
        else:
            out.append(chunk['value'])
    return ''.join(out)

# Improved parser: preserves original lines, keys, values, comments, and newlines
def parse_lang_file(file_path):
    parsed = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            # Remove all trailing newlines and carriage returns
            original = line.rstrip('\r\n')
            if not original.strip():
                parsed.append({'type': 'empty', 'original': original})
                continue
            if original.lstrip().startswith('##'):
                parsed.append({'type': 'comment', 'original': original})
                continue
            if '=' in original:
                key, rest = original.split('=', 1)
                value, comment = (rest.split('##', 1) if '##' in rest else (rest, ''))
                parsed.append({
                    'type': 'entry',
                    'key': key,
                    'value': value,
                    'comment': comment,
                    'original': original
                })
            else:
                parsed.append({'type': 'other', 'original': original})
    return parsed

def write_lang_file(file_path, lines):
    with open(file_path, 'w', encoding='utf-8') as f:
        for item in lines:
            if item['type'] == 'entry':
                line = item['key'] + '=' + item['value']
                if item['comment']:
                    line += '##' + item['comment']
                f.write(line + '\n')
            else:
                f.write(item['original'] + '\n')

def insert_translator_credit(lines, lang_name):
    '''
    Inserts a translator credit entry into the language file.

    Args:
        lines (list): List of parsed lines from the language file.
        lang_name (str): Readable language name (e.g., 'Spanish').
    '''
    key = settings.get('translator_credit_key')
    value_format = settings.get('translator_credit_value')
    if not key or not value_format:
        return lines
    credit_value = value_format.replace('{lang}', lang_name)

    for item in lines:
        if item['type'] == 'entry' and item['key'] == key:
            if not item['value'].strip():
                item['value'] = credit_value
                item['original'] = f"{key}={credit_value} ## Auto-generated translator credit"
            return lines

    lines.append({
        'type': 'entry',
        'key': key,
        'value': credit_value + "   ", # spacing is added to make the comment valid
        'comment': 'Auto-generated translator credit',
        'original': f"{key}={credit_value} ## Auto-generated translator credit"
    })
    return lines

async def main():

    # if a cached lang files does not exist, copy it over
    if not os.path.exists(CACHED_FILE):
        os.makedirs(os.path.dirname(CACHED_FILE), exist_ok=True)
        write_lang_file(CACHED_FILE, parse_lang_file(SOURCE_FILE))

    # MARK: Manual Translate
    for lang in TARGET_LANGS_MANUAL:
        in_lines = parse_lang_file(SOURCE_FILE)
        cached_lines = parse_lang_file(CACHED_FILE)

        existing_file_path = os.path.join(DESTINATION_FOLDER, f'{lang}.lang')
        existing_lines = []
        if os.path.exists(existing_file_path):
            existing_lines = parse_lang_file(existing_file_path)

        # Build a dict for cached entries for quick lookup
        cached_dict = {item['key']: item for item in cached_lines if item['type'] == 'entry'}

        out_lines = []
        for in_item in in_lines:
            if in_item['type'] == 'entry':
                cached_item = cached_dict.get(in_item['key'])

                existing_item = None
                for item in existing_lines:
                    if item['type'] == 'entry' and item['key'] == in_item['key']:
                        existing_item = item
                        break

                # If the English source has changed, blank out and add TODO
                if (not existing_item) or (not cached_item) or (in_item['value'] != cached_item['value']):
                    comment = in_item['comment']
                    TODO_tag = f'TODO: Translate the following "{in_item['value']}"'

                    if comment:
                        comment += ' | ' + TODO_tag
                    else:
                        comment = TODO_tag

                    out_lines.append({
                        'type': 'entry',
                        'key': in_item['key'],
                        'value': '',
                        'comment': comment,
                        'original': in_item['original']
                    })
                else:
                    # If manual translation exists, use it
                    out_lines.append(existing_item)
                    
            else:
                # Preserve all non-entry lines exactly as in the source
                out_lines.append(in_item)

        out_path = f"{DESTINATION_FOLDER}{f'{lang}'}.lang"
        write_lang_file(out_path, out_lines)
        print(f"Prepared manual translation for {lang}: {out_path}")

    # update the cached file to the latest source
    write_lang_file(CACHED_FILE, parse_lang_file(SOURCE_FILE))

    # MARK: Auto Translate
    for lang in TARGET_LANGS_AUTO:
        in_lines = parse_lang_file(SOURCE_FILE)
        cached_lines = parse_lang_file(CACHED_FILE)
        existing_file_path = os.path.join(DESTINATION_FOLDER, f'{lang}.lang')
        existing_lines = parse_lang_file(existing_file_path) if os.path.exists(existing_file_path) else []

        cached_dict = {item['key']: item for item in cached_lines if item['type'] == 'entry'}
        existing_dict = {item['key']: item for item in existing_lines if item['type'] == 'entry'}

        out_lines = []
        changed_entries = []
        source_keys = set()

        for item in in_lines:
            if item['type'] != 'entry':
                out_lines.append(item)
                continue

            key = item['key']
            source_keys.add(key)
            cached_item = cached_dict.get(key)
            existing_item = existing_dict.get(key)

            if existing_item and cached_item and item['value'] == cached_item['value']:
                out_lines.append(existing_item)
                continue

            changed_entries.append((len(out_lines), item))
            out_lines.append({
                'type': 'entry',
                'key': item['key'],
                'value': '',
                'comment': item['comment'],
                'original': item['original']
            })

        for item in existing_lines:
            if item['type'] == 'entry' and item['key'] not in source_keys:
                out_lines.append(item)

        if changed_entries:
            all_texts = []
            batch_specs = []
            for out_idx, item in changed_entries:
                chunks = split_value_chunks(item['value'])
                texts = [c['value'] for c in chunks if c['type'] == 'text']
                if not texts:
                    out_lines[out_idx] = {
                        'type': 'entry',
                        'key': item['key'],
                        'value': '',
                        'comment': item['comment'],
                        'original': item['original']
                    }
                    continue
                batch_specs.append((out_idx, chunks))
                all_texts.extend(texts)

            translated_texts = []
            if all_texts:
                async with Translator() as translator:
                    translations = await translator.translate(all_texts, dest=lang.split('_')[0])
                translated_texts = [t.text for t in translations]

            text_cursor = 0
            for out_idx, chunks in batch_specs:
                num_texts = sum(1 for c in chunks if c['type'] == 'text')
                translated = reassemble_chunks(chunks, translated_texts[text_cursor:text_cursor + num_texts])
                text_cursor += num_texts
                out_lines[out_idx] = {
                    'type': 'entry',
                    'key': out_lines[out_idx]['key'],
                    'value': translated,
                    'comment': out_lines[out_idx]['comment'],
                    'original': out_lines[out_idx]['original']
                }

        out_lines = insert_translator_credit(out_lines, LANGUAGES[lang.split('_')[0]].capitalize())

        out_path = f"{DESTINATION_FOLDER}{f'{lang}'}.lang"
        write_lang_file(out_path, out_lines)
        print(f"Translated to {lang}: {out_path}")

if __name__ == '__main__':
    asyncio.run(main())