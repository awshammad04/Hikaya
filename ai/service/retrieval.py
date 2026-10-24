"""Language-aware tokenization and lightweight BM25 scoring for guide retrieval."""

import math
import re
import unicodedata
from typing import Dict, List, Sequence, Set

_ARABIC_DIACRITICS_RE = re.compile(r"[\u064b-\u065f\u0670\u06d6-\u06ed]")
_TOKEN_RE = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)
_ARABIC_TRANSLATION = str.maketrans({
    "أ": "ا",
    "إ": "ا",
    "آ": "ا",
    "ٱ": "ا",
    "ى": "ي",
    "ة": "ه",
})
_ARABIC_STOPWORDS = {
    "ا", "الى", "ان", "انا", "انت", "انتم", "او", "اي", "اين", "الذي",
    "التي", "الذين", "اللاتي", "اللواتي", "ما", "ماذا", "متى", "من", "هل",
    "هو", "هي", "هم", "هن", "هذا", "هذه", "هناك", "ذلك", "تلك", "في",
    "عن", "على", "مع", "بين", "بعد", "قبل", "كان", "كانت", "يكون", "تكون",
    "كم", "كيف", "لماذا", "ماهو", "ماهي", "الي", "ال", "و", "يا",
    # Common Palestinian colloquial question words.
    "شو", "ايش", "وين", "ليش", "قديش", "هاد", "هاي", "فيه", "فيها",
}
_ENGLISH_STOPWORDS = {
    "a", "about", "all", "and", "any", "are", "as", "at", "be", "been",
    "but", "by", "can", "did", "do", "does", "for", "from", "had", "has",
    "have", "how", "in", "is", "it", "its", "many", "me", "much", "not",
    "of", "on", "or", "please", "tell", "that", "the", "their", "there",
    "they", "this", "to", "today", "was", "were", "what", "when", "where",
    "which", "who", "why", "will", "with", "you", "your", "here", "near",
    "nearby", "some", "something", "anything", "best", "i", "my", "we", "us",
    "should", "could", "would", "see",
}
# Words that make a question about where a place is.
LOCATION_WORDS = {
    "where", "located", "location", "address", "situated",
    "اين", "وين", "تقع", "يقع", "موقع",
}
_PLACE_WORDS = {"town", "village", "city", "بلده", "مدينه", "قريه"}


def is_location_question(words: Set[str]) -> bool:
    """True for "where is it?" and "which town is it in?", not for "the Old City"."""
    if words & LOCATION_WORDS:
        return True
    place_words = words & _PLACE_WORDS
    if not place_words:
        return False
    # "the Old City" / "البلدة القديمة" names a place; it does not ask for one.
    old_city = ("old" in words and "city" in words) or (
        "بلده" in words and any(word.startswith("قديم") for word in words))
    return not old_city or len(place_words) > 1
_ALIASES = {
    "تاريخ": "تاريخ history",
    "تاريخي": "تاريخ history",
    "متى": "متى when",
    "اكتمل": "اكتمل completed",
    "اكمل": "اكمل completed",
    "اهميه": "اهميه importance",
    "ثقافي": "ثقافي cultural",
    "معالم": "معالم landmarks",
    "بني": "بني built",
    "بنا": "بنا built",
    "عصر": "عصر era",
    "فتره": "فتره period",
    "اقدم": "اقدم oldest",
    "الاقرب": "الاقرب near",
    "حاره المسلمين": "حاره المسلمين muslim quarter",
    "حاره النصارى": "حاره النصارى christian quarter",
    "حاره الارمن": "حاره الارمن armenian quarter",
    "حاره المغاربه": "حاره المغاربه maghariba quarter",
    "الشيخ جراح": "الشيخ جراح sheikh jarrah",
    "سلوان": "سلوان silwan",
    "جبل الزيتون": "جبل الزيتون mount of olives",
    "الطور": "الطور at tur",
    "باب العامود": "باب العامود bab al amud",
    "باب حطه": "باب حطه bab hatta",
    "سوق القطانين": "سوق القطانين souq al qattanin cotton market",
    "المتحف الفلسطيني": "المتحف الفلسطيني palestinian museum",
    "متحف ياسر عرفات": "متحف ياسر عرفات yasser arafat museum",
    "البلده القديمه في الخليل": "البلده القديمه في الخليل hebron old town",
}
_SYNONYMS = {
    "called": {"name", "named", "recall", "known"},
    "name": {"called", "named", "recall"},
    "commissioned": {"built", "under", "ordered"},
    "open": {"completed", "opened", "inaugurated"},
    "opened": {"completed", "open", "inaugurated"},
    "big": {"area", "square", "metre", "size"},
    "size": {"area", "square", "metre", "big"},
    "associated": {"tradition", "associate", "linked"},
    "architect": {"designed", "design", "architect"},
    "designed": {"architect", "design"},
    "built": {"build", "constructed", "construction"},
    "construction": {"built", "constructed", "build"},
    "constructed": {"build", "built", "construction"},
    "era": {"period", "age"},
    "period": {"era", "age", "mamluk", "mamluks", "ottoman", "ottomans"},
    "oldest": {"earliest", "first"},
    "earliest": {"oldest", "first"},
    "where": {"location", "located"},
    "located": {"location", "where"},
    "location": {"located", "where"},
}
_ARABIC_LIGHT_PREFIXES = ("وال", "بال", "كال", "فال", "لل", "ال")
# "ان" is deliberately absent: it ends many names (سليمان، السلطان، عثمان) and
# stripping it merged different words; short inflections are matched by
# :func:`same_stem` instead.
_ARABIC_LIGHT_SUFFIXES = ("يات", "ات", "ون", "ين", "ها", "هم", "هن", "كم", "نا", "ية", "يه")


def normalize_arabic(text: str) -> str:
    """Normalize Arabic spelling variants without changing the source text."""
    text = unicodedata.normalize("NFKC", text)
    text = _ARABIC_DIACRITICS_RE.sub("", text).replace("ـ", "")
    return text.translate(_ARABIC_TRANSLATION).lower()


def _normalize_token(token: str) -> str:
    token = normalize_arabic(token.replace("’", "'")).lower()
    if token and "\u0600" <= token[0] <= "\u06ff":
        for prefix in _ARABIC_LIGHT_PREFIXES:
            if token.startswith(prefix) and len(token) - len(prefix) >= 3:
                token = token[len(prefix):]
                break
        for suffix in _ARABIC_LIGHT_SUFFIXES:
            if token.endswith(suffix) and len(token) - len(suffix) >= 3:
                token = token[:-len(suffix)]
                break
    elif token.endswith("ies") and len(token) > 5:
        token = token[:-3] + "y"
    elif token.endswith("s") and len(token) > 4 and not token.endswith("ss"):
        token = token[:-1]
    return token


def same_stem(term: str, token: str) -> bool:
    """Exact match, or an Arabic inflection one or two letters longer (بني/بنيت)."""
    if term == token:
        return True
    if not term or not token or not ("\u0600" <= term[0] <= "\u06ff"):
        return False
    shorter, longer = (term, token) if len(term) <= len(token) else (token, term)
    return len(shorter) >= 3 and len(longer) - len(shorter) <= 2 and longer.startswith(shorter)


def tokens(text: str) -> List[str]:
    """Return normalized English and Arabic tokens with light Arabic stemming."""
    text = normalize_arabic(text)
    output = []
    for match in _TOKEN_RE.finditer(text):
        token = _normalize_token(match.group(0))
        if token:
            output.append(token)
    return output


_ARABIC_STOPWORDS = _ARABIC_STOPWORDS | {_normalize_token(word) for word in _ARABIC_STOPWORDS}
_ENGLISH_STOPWORDS = _ENGLISH_STOPWORDS | {_normalize_token(word) for word in _ENGLISH_STOPWORDS}


def query_terms(
    question: str, location_name: str = "", include_synonyms: bool = True
) -> Set[str]:
    """Expand Arabic aliases and simple English synonyms into retrieval terms."""
    normalized = normalize_arabic(question)
    expanded = normalized
    for phrase, replacement in _ALIASES.items():
        expanded = expanded.replace(phrase, replacement)
    raw_words = set(tokens(expanded))
    words = set(raw_words)
    location_question = is_location_question(raw_words)
    location_names = set() if location_question else set(tokens(location_name))
    stopwords = _ENGLISH_STOPWORDS | _ARABIC_STOPWORDS
    words = {word for word in words if word not in stopwords and len(word) > 1}
    # Drop the place's own name, unless it is all the question is about
    # ("Why is it called Bab al-Amud?").
    without_name = words - location_names
    if without_name:
        words = without_name
    if not has_arabic(question) and any(
        word in raw_words for word in ("where", "located", "location")
    ):
        words.update(("from", "toward"))
    if include_synonyms:
        for word in tuple(words):
            words.update(_SYNONYMS.get(word, ()))
    return words


def bm25_scores(query: Set[str], documents: Sequence[Sequence[str]]) -> List[float]:
    """Return Okapi BM25 scores in document order."""
    if not query or not documents:
        return [0.0] * len(documents)
    lengths = [len(document) for document in documents]
    average_length = sum(lengths) / len(lengths) if lengths else 0.0
    if average_length == 0:
        return [0.0] * len(documents)
    frequencies: Dict[str, int] = {}
    for term in query:
        frequencies[term] = sum(
            1 for document in documents if any(same_stem(term, token) for token in document)
        )
    scores = []
    for document, length in zip(documents, lengths):
        score = 0.0
        counts = {}
        for token in document:
            for term in query:
                if same_stem(term, token):
                    counts[term] = counts.get(term, 0) + 1
        for term, frequency in counts.items():
            document_frequency = frequencies[term]
            inverse_frequency = math.log(
                1.0 + (len(documents) - document_frequency + 0.5)
                / (document_frequency + 0.5)
            )
            term_frequency = (
                frequency * 2.5
                / (frequency + 1.5 * (0.25 + 0.75 * length / average_length))
            )
            score += inverse_frequency * term_frequency
        scores.append(score)
    return scores


def has_arabic(text: str) -> bool:
    return any("\u0600" <= character <= "\u06ff" for character in text)


def arabic_terms(text: str) -> Set[str]:
    return {
        token for token in tokens(text)
        if token not in _ARABIC_STOPWORDS
        and token
        and "\u0600" <= token[0] <= "\u06ff"
    }


def term_matches(term: str, document_terms: Sequence[str]) -> bool:
    """Check a base query term against itself and its curated synonyms."""
    candidates = {term} | _SYNONYMS.get(term, set())
    return any(same_stem(candidate, token) for candidate in candidates for token in document_terms)
