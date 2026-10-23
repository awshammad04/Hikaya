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
}
_ENGLISH_STOPWORDS = {
    "a", "about", "all", "and", "any", "are", "as", "at", "be", "been",
    "but", "by", "can", "did", "do", "does", "for", "from", "had", "has",
    "have", "how", "in", "is", "it", "its", "many", "me", "much", "not",
    "of", "on", "or", "please", "tell", "that", "the", "their", "there",
    "they", "this", "to", "today", "was", "were", "what", "when", "where",
    "which", "who", "why", "will", "with", "you", "your", "here", "near",
    "nearby", "some", "something", "anything",
}
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
_ARABIC_LIGHT_SUFFIXES = ("يات", "ات", "ون", "ين", "ان", "ها", "هم", "هن", "كم", "نا", "ية", "يه")


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


def tokens(text: str) -> List[str]:
    """Return normalized English and Arabic tokens with light Arabic stemming."""
    text = normalize_arabic(text)
    output = []
    for match in _TOKEN_RE.finditer(text):
        token = _normalize_token(match.group(0))
        if token:
            output.append(token)
    return output


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
    location_question = bool(
        raw_words
        & {
            "where", "located", "location", "town", "city", "village", "address",
            "situated", "اين", "وين", "تقع", "موقع", "بلده", "مدينه",
        }
    )
    location_names = set() if location_question else set(tokens(location_name))
    ignored = _ENGLISH_STOPWORDS | _ARABIC_STOPWORDS | location_names
    words = {word for word in words if word not in ignored and len(word) > 1}
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
        frequencies[term] = sum(1 for document in documents if term in document)
    scores = []
    for document, length in zip(documents, lengths):
        score = 0.0
        counts = {}
        for term in document:
            if term in query:
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
    return bool(({term} | _SYNONYMS.get(term, set())) & set(document_terms))
