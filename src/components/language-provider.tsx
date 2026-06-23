"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Minimal bilingual i18n — English (canonical) + Mandarin Chinese.
 *
 * Why hand-rolled rather than next-intl / lingui:
 *   • The site is a personal journal. Adding a framework-grade i18n
 *     runtime would be overkill and would bloat the client bundle.
 *   • The dictionary lives next to the component tree, so translations
 *     are discoverable and reviewable in a single file.
 *
 * Translation quality policy — future entries added by the owner ship
 * with both an English canonical body (`description`) and an optional
 * `descriptionZh`. The renderer picks the right one based on the
 * currently-selected language; when a Chinese translation is absent
 * (e.g. historical imports) the English body is shown verbatim so
 * information is never hidden.
 */

export type Lang = "en" | "zh";

type Dict = Record<string, { en: string; zh: string }>;

/**
 * All UI-chrome strings live here. Keep keys short but descriptive so
 * the call-sites read naturally: `t("hero.title")`.
 */
const DICT: Dict = {
  "lang.toggle.en": { en: "English", zh: "英文" },
  "lang.toggle.zh": { en: "中文", zh: "中文" },
  "lang.switchTo.en": { en: "Switch to English", zh: "切换到英文" },
  "lang.switchTo.zh": { en: "Switch to Chinese", zh: "切换到中文" },

  "nav.overview": { en: "Overview", zh: "概览" },
  "nav.calendar": { en: "Calendar", zh: "日历" },
  "nav.import": { en: "Import", zh: "导入" },
  "nav.export": { en: "Export", zh: "导出" },
  "nav.share": { en: "Share", zh: "分享" },
  "nav.signIn": { en: "Sign in", zh: "登录" },
  "nav.signOut": { en: "Sign out", zh: "登出" },
  "nav.home": { en: "Home", zh: "首页" },

  "theme.toLight": { en: "Switch to light mode", zh: "切换到浅色模式" },
  "theme.toDark": { en: "Switch to dark mode", zh: "切换到深色模式" },

  "hero.title": {
    en: "Bryan 郭檍祥 Daily Progress",
    zh: "郭檍祥 Bryan 每日进展",
  },

  "admin.logToday.title": {
    en: "Log today's work",
    zh: "记录今天的工作",
  },
  "admin.logToday.hint": {
    en: "Add a new entry to the journal.",
    zh: "向日志中添加一条新记录。",
  },
  "admin.logToday.cta": { en: "New entry →", zh: "新记录 →" },

  "journal.empty": { en: "No entries yet.", zh: "暂无记录。" },
  "journal.loadingMore": {
    en: "Loading older entries…",
    zh: "正在加载更早的记录…",
  },
  "journal.keepScrolling": {
    en: "Keep scrolling to load more",
    zh: "继续滚动以加载更多",
  },
  "journal.reachedStart": {
    en: "You've reached the start of the log.",
    zh: "已到达日志起点。",
  },
  "journal.retry": { en: "retry", zh: "重试" },
  "journal.regionLabel": {
    en: "Daily progress journal — scroll to load older entries",
    zh: "每日进展日志——滚动以加载更早的记录",
  },

  "day.edit": { en: "Edit", zh: "编辑" },
  "day.comments": { en: "Comments", zh: "备注" },
  "day.live": { en: "Live", zh: "进行中" },

  "signin.title": { en: "Sign in", zh: "登录" },
  "signin.subtitle": {
    en: "Reserved for the report owner. Visitors can browse everything without signing in.",
    zh: "仅限日志所有者登录。访客无需登录即可浏览全部内容。",
  },
  "signin.username": { en: "Username", zh: "用户名" },
  "signin.password": { en: "Password", zh: "密码" },
  "signin.submit": { en: "Sign in", zh: "登录" },
  "signin.submitting": { en: "Signing in…", zh: "正在登录…" },
  "signin.error": {
    en: "That username and password don't match our records. Please check for typos and try again.",
    zh: "用户名或密码有误。请检查后重试。",
  },
  "signin.close": { en: "Close", zh: "关闭" },

  "footer.owner": { en: "Bryan 郭檍祥", zh: "郭檍祥 Bryan" },
  "footer.role": {
    en: "Solutions Architect Intern · Tencent Cloud International",
    zh: "解决方案架构师实习生 · 腾讯云国际",
  },
  "footer.location": {
    en: "Jakarta · 2025 – 2026",
    zh: "雅加达 · 2025 – 2026",
  },
  "footer.thisSite": { en: "This site", zh: "本站" },
  "footer.rights": {
    en: "All rights reserved.",
    zh: "保留所有权利。",
  },
  "footer.switchRole": { en: "Switch role", zh: "切换身份" },

  // ---- Structured daily template (added 2026-05-16) ------------------
  "section.workLog": { en: "Work log", zh: "工作日志" },
  "section.topThings": { en: "Focus", zh: "今日重点" },
  "section.completed": { en: "Logs", zh: "工作记录" },
  "section.progressing": { en: "Pending", zh: "待办" },
  "section.tomorrow": { en: "Carry On", zh: "明日延续" },
  "section.workLog.empty": {
    en: "No time blocks logged.",
    zh: "暂未记录时间块。",
  },
  "section.outcomes.empty": { en: "—", zh: "—" },
  "section.legacy.disclosure_one": {
    en: "+ {n} time-blocked entry",
    zh: "+ {n} 条时间块记录",
  },
  "section.legacy.disclosure_other": {
    en: "+ {n} time-blocked entries",
    zh: "+ {n} 条时间块记录",
  },

  // ---- Today composer (Owner) ----------------------------------------
  "today.title": { en: "Today", zh: "今天" },
  "today.subtitle": {
    en: "Capture today's notes — work log, focus, logs, pending, and carry on.",
    zh: "记录今天的工作日志、重点、工作记录、待办与明日延续。",
  },
  "today.workLog.add": { en: "+ Add row", zh: "+ 添加一行" },
  "today.workLog.time": { en: "Time", zh: "时间" },
  "today.workLog.note": { en: "What you worked on", zh: "工作内容" },
  "today.topThings.add": { en: "+ Add Focus", zh: "+ 添加重点" },
  "today.topThings.placeholder": {
    en: "e.g. Telkomsel Maxstream POC",
    zh: "例：Telkomsel Maxstream POC",
  },
  "today.outcomes.add": { en: "+ Add", zh: "+ 添加" },
  "today.outcomes.note": { en: "What happened", zh: "发生了什么" },
  "today.outcomes.linkTo": { en: "Link to Focus", zh: "关联重点" },
  "today.outcomes.assoc": {
    en: "or free-text reference",
    zh: "或填写自由关联",
  },
  "today.save": { en: "Save today", zh: "保存今日" },
  "today.saveShortcut": {
    en: "⌘/Ctrl + Enter",
    zh: "⌘/Ctrl + Enter",
  },
  "today.saved": { en: "Saved · {time}", zh: "已保存 · {time}" },
  "today.errors.topThings": {
    en: "Add at least one Focus item for today.",
    zh: "请为今天至少填写一个重点任务。",
  },
  "today.quickRow.title": { en: "+ Add to Work log", zh: "+ 追加到工作日志" },
  "today.quickRow.append": { en: "Append", zh: "追加" },
  "today.legacyCta": {
    en: "Backfill an older day in legacy time-block format →",
    zh: "以时间块格式补记之前的一天 →",
  },

  // ---- Welcome gate --------------------------------------------------
  "welcome.title": { en: "Welcome", zh: "欢迎" },
  "welcome.owner": { en: "I'm Bryan", zh: "我是 Bryan" },
  "welcome.visitor": { en: "I'm a Visitor", zh: "我是访客" },

  // ---- Visitor weekly strip ------------------------------------------
  "thisWeek.title": { en: "This week", zh: "本周概览" },
  "thisWeek.subtitle": {
    en: "Latest 5 working days, top thing per day.",
    zh: "最近5个工作日的重点。",
  },
  "thisWeek.completed": { en: "completed", zh: "完成" },
  "thisWeek.progressing": { en: "in progress", zh: "进行中" },

  "ai.title": { en: "AI Summary", zh: "AI 总结" },
  "ai.subtitle": {
    en: "Generate a summary of Bryan's daily progress.",
    zh: "生成 Bryan 每日进展的总结。",
  },
  "ai.period": { en: "Period", zh: "时间段" },
  "ai.from": { en: "From", zh: "起" },
  "ai.to": { en: "To", zh: "止" },
  "ai.periodDaily": { en: "Today", zh: "今天" },
  "ai.periodWeekly": { en: "This week", zh: "本周" },
  "ai.periodMonthly": { en: "This month", zh: "本月" },
  "ai.generate": { en: "Generate summary", zh: "生成总结" },
  "ai.writing": { en: "Writing…", zh: "正在撰写…" },
  "ai.copy": { en: "Copy", zh: "复制" },
  "ai.copied": { en: "Copied", zh: "已复制" },
  "ai.placeholder": {
    en: "Press the button to get started.",
    zh: "点击按钮开始生成。",
  },
  "ai.entries_one": { en: "entry", zh: "条记录" },
  "ai.entries_other": { en: "entries", zh: "条记录" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof DICT) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

/**
 * LanguageProvider — stores the preference in localStorage and mirrors
 * it onto <html lang="…"> so browser heuristics, screen readers and
 * extensions pick it up correctly.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Load persisted preference exactly once on mount. We don't try to
  // guess from navigator.language — the owner has asked for an explicit
  // toggle, and silent auto-detection tends to surprise shared viewers.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("lang");
      if (stored === "en" || stored === "zh") {
        setLangState(stored);
        document.documentElement.setAttribute("lang", stored);
      }
    } catch {
      /* storage unavailable — keep default */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", l);
    }
  }, []);

  const t = useCallback(
    (key: keyof typeof DICT) => DICT[key]?.[lang] ?? DICT[key]?.en ?? String(key),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // A defensive fallback so components outside the provider (e.g.
    // server components rendered in isolation during tests) still work.
    return {
      lang: "en",
      setLang: () => {},
      t: (key) => DICT[key]?.en ?? String(key),
    };
  }
  return ctx;
}

/**
 * Format a weekday name in the current language. Uses the native
 * Intl API so the labels match platform conventions (e.g. 星期一 / Monday).
 */
export function formatWeekday(iso: string, lang: Lang): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/**
 * Format a month-year header in the current language.
 * YYYY-MM → "April 2026" / "2026年4月".
 */
export function formatMonthLabel(ym: string, lang: Lang): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format an ISO date (YYYY-MM-DD) in the current language. Returns a
 * compact, locale-appropriate rendering suitable for the day heading.
 */
export function formatDateLabel(iso: string, lang: Lang): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
