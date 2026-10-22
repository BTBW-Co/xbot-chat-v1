import { AsYouType, getCountries, getCountryCallingCode } from 'libphonenumber-js/min'

/** Quando o DDI é compartilhado e o número ainda não distingue o país. */
const PREFERRED_ISO = {
  1: 'US',
  7: 'RU',
  39: 'IT',
  44: 'GB',
  47: 'NO',
  61: 'AU',
  212: 'MA',
  262: 'RE',
  290: 'SH',
  358: 'FI',
  590: 'GP',
  599: 'CW',
}

const callingIndex = new Map()
for (const iso of getCountries()) {
  const code = getCountryCallingCode(iso)
  if (!callingIndex.has(code)) callingIndex.set(code, [])
  callingIndex.get(code).push(iso)
}

export function countryFlagEmoji(iso) {
  const code = String(iso || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(0x1f1e6 + code.charCodeAt(0) - 65, 0x1f1e6 + code.charCodeAt(1) - 65)
}

function regionName(names, iso) {
  try {
    return names.of(iso) || iso
  } catch {
    return iso
  }
}

export function isoForCalling(callingCode) {
  const code = String(callingCode || '')
  const list = callingIndex.get(code) || []
  const preferred = PREFERRED_ISO[code]
  if (preferred && list.includes(preferred)) return preferred
  return list[0] || ''
}

/** exact = DDI de um país. prefix = ainda incompleto. invalid = não existe. */
export function classifyCalling(callingCode) {
  const code = String(callingCode || '')
  if (!code) return 'empty'
  if (callingIndex.has(code)) return 'exact'
  for (const known of callingIndex.keys()) {
    if (known.startsWith(code)) return 'prefix'
  }
  return 'invalid'
}

function isoForExactCalling(callingCode, preferredIso) {
  const fallback = getCountries().includes(preferredIso) ? preferredIso : 'BR'
  if (getCountryCallingCode(fallback) === callingCode) return fallback
  return isoForCalling(callingCode) || fallback
}

export function suggestIso(locale, language = '') {
  const region = String(language || '').split('-')[1] || ''
  if (/^[a-zA-Z]{2}$/.test(region)) {
    const iso = region.toUpperCase()
    if (getCountries().includes(iso)) return iso
  }
  if (locale === 'pt') return 'BR'
  if (locale === 'es') return 'ES'
  if (locale === 'zh') return 'CN'
  return 'US'
}

export function listCountries(locale) {
  const names = new Intl.DisplayNames([locale || 'en'], { type: 'region' })
  return getCountries()
    .map((iso) => ({
      iso,
      code: getCountryCallingCode(iso),
      name: regionName(names, iso),
      flag: countryFlagEmoji(iso),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale || 'en'))
}

/** Máscara nacional do país, com o DDI na frente. Vazio mostra só o código. */
export function displayPhone(iso, national) {
  const calling = getCountryCallingCode(iso)
  const digits = String(national || '').replace(/\D/g, '')
  if (!digits) return `+${calling}`
  return `+${calling} ${new AsYouType(iso).input(digits)}`
}

/**
 * Lê os dígitos do campo (DDI + nacional).
 * Sem dígitos, o campo fica só com o +.
 * DDI incompleto ou inexistente fica pendente e sem país.
 * DDI reconhecido troca o país, exceto quando o código continua o mesmo (EUA/Canadá).
 */
export function resolvePhone(digits, preferredIso = 'BR') {
  const clean = String(digits || '').replace(/\D/g, '').slice(0, 15)
  const preferred = getCountries().includes(preferredIso) ? preferredIso : ''
  if (!clean) {
    return { iso: '', national: '', pending: true, display: '+', e164: '' }
  }
  const typer = new AsYouType()
  typer.input(`+${clean}`)
  const calling = typer.getCallingCode() || ''
  if (!calling || !clean.startsWith(calling) || classifyCalling(calling) !== 'exact') {
    return { iso: '', national: '', pending: true, display: `+${clean}`, e164: '' }
  }
  let iso = preferred
  if (!preferred || getCountryCallingCode(preferred) !== calling) {
    iso = typer.getCountry() || isoForCalling(calling) || ''
  }
  if (!iso) {
    return { iso: '', national: '', pending: true, display: `+${clean}`, e164: '' }
  }
  const national = clean.slice(calling.length)
  return {
    iso,
    national,
    pending: false,
    display: displayPhone(iso, national),
    e164: `${calling}${national}`,
  }
}

/** Separa o DDI digitado do número nacional quando há um separador depois do código. */
export function splitPhoneInput(raw) {
  const match = String(raw ?? '').match(/^\s*\+?(\d*)([\s\S]*)$/)
  const head = match?.[1] || ''
  const tail = match?.[2] || ''
  if (tail && /\D/.test(tail[0])) {
    return {
      separated: true,
      calling: head.slice(0, 3),
      national: tail.replace(/\D/g, '').slice(0, 15),
    }
  }
  return { separated: false, digits: (head + tail).replace(/\D/g, '').slice(0, 15) }
}

function draftPhone(formatIso, calling, national) {
  const code = String(calling || '').replace(/\D/g, '').slice(0, 3)
  const local = String(national || '').replace(/\D/g, '')
  if (!code && !local) return '+'
  if (!local) return `+${code}`
  const formatted = getCountries().includes(formatIso) ? new AsYouType(formatIso).input(local) : local
  if (!code) return `+ ${formatted}`.trimEnd()
  return `+${code} ${formatted}`.trimEnd()
}

/**
 * Lê o que foi digitado no campo.
 * O + inicial permanece. DDI válido troca o país.
 * DDI incompleto ou inexistente fica sem país e pendente.
 */
export function readPhoneField(raw, preferredIso = 'BR') {
  const fallback = getCountries().includes(preferredIso) ? preferredIso : ''
  const text = `+${String(raw ?? '').replace(/\+/g, '')}`
  const split = splitPhoneInput(text)
  if (!split.separated) {
    const parsed = resolvePhone(split.digits, fallback)
    return {
      iso: parsed.iso,
      digits: split.digits,
      pending: parsed.pending,
      display: parsed.display,
    }
  }
  const calling = split.calling
  const national = split.national.slice(0, Math.max(0, 15 - calling.length))
  if (classifyCalling(calling) === 'exact') {
    const iso = isoForExactCalling(calling, fallback || 'BR')
    const digits = `${calling}${national}`.slice(0, 15)
    const parsed = resolvePhone(digits, iso)
    return { iso: parsed.iso, digits, pending: parsed.pending, display: parsed.display }
  }
  return {
    iso: '',
    digits: `${calling}${national}`.slice(0, 15),
    pending: true,
    display: draftPhone(fallback, calling, national),
  }
}

/** DDI reconhecido e número com tamanho de telefone. */
export function canSubmitPhone(digits, iso, pending = false) {
  if (pending || !getCountries().includes(iso)) return false
  const resolved = resolvePhone(digits, iso)
  if (resolved.pending || !resolved.iso) return false
  return resolved.e164.length >= 10 && resolved.e164.length <= 15
}

export function digitsForCountry(nextIso, currentDigits, currentIso) {
  const current = resolvePhone(currentDigits, currentIso)
  const national = current.pending ? '' : current.national
  return `${getCountryCallingCode(nextIso)}${national}`.slice(0, 15)
}

/** Posição do cursor depois de `count` dígitos na máscara. Nunca fica antes do +. */
export function caretForDigitCount(value, count) {
  const plusAt = String(value || '').indexOf('+')
  const min = plusAt >= 0 ? plusAt + 1 : 0
  if (!count) return min
  let seen = 0
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i])) {
      seen += 1
      if (seen === count) return Math.max(i + 1, min)
    }
  }
  return value.length
}
