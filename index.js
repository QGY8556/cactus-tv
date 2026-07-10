import { connect } from "cloudflare:sockets";
import YAML from "yaml";

const APP_VERSION = "2.1.0";
const DEFAULT_CHECK_TIMEOUT_MS = 2_000;
const SESSION_DAYS = 7;
const SHANGHAI_OFFSET_MINUTES = 8 * 60;
const DAY_MS = 86_400_000;
const PROBE_TARGET_HOST = "httpbingo.org";
const PROBE_TARGET_PORT = 80;
const PROBE_TARGET_PATH = "/anything/cactus";
const SUPPORTED_SS_AEAD = new Map([
  ["aes-128-gcm", 16],
  ["aes-192-gcm", 24],
  ["aes-256-gcm", 32],
]);

const DEFAULT_SETTINGS = {
  site_name: "Cactus Node",
  site_subtitle: "每天分享最新免费节点",
  site_description: "每天更新 Clash、V2Ray、小火箭可用订阅。打开当天文章，复制链接直接导入。",
  site_notice: "",
  site_author: "Cactus Node",
  seo_keywords: "免费节点,Clash订阅,V2Ray订阅,节点测活,每日节点",
  hero_badge: "今天已经更新",
  hero_title: "每天一篇，",
  hero_highlight: "订阅当天更新",
  hero_description: "Clash、V2Ray、小火箭订阅每天更新。想看视频、刷 4K，先从今天这批里试。",
  hero_note: "旧订阅保留 5 天，过期就回来拿新的。",
  about_title: "关于 Cactus Node",
  about_text: "这里每天分享一批新的免费节点。打开当天文章，Clash 和 V2Ray 订阅都在文末。",
  posts_per_page: "8",
  daily_test_time: "16:00",
  report_delay_minutes: "60",
  auto_publish: "1",
  telegram_name: "Telegram 更新频道",
  telegram_url: "",
  telegram_description: "当天更新、临时补充和失效提醒，会先发到频道。",
  airport_name: "稳定线路推荐",
  airport_url: "",
  airport_description: "想要 4K 秒开、晚高峰也稳一点，可以看看站长正在用的线路。",
  airport_badge: "4K 线路推荐",
  airport_cta: "看看稳定线路",
  faq_1_q: "订阅怎么用？",
  faq_1_a: "打开当天文章，在文末复制 Clash 或 V2Ray 链接，粘贴到软件里更新即可。",
  faq_2_q: "为什么最好用当天的？",
  faq_2_a: "免费线路变化快，昨天顺手的今天可能已经失效。当天文章里的订阅通常更新。",
  faq_3_q: "能看 4K 吗？",
  faq_3_a: "当天更新里会有适合看视频的线路，不同地区表现不一样。卡顿就换一条，通常比一直等更快。",
  footer_text: "收藏本站，失效了就回来换当天的新订阅。",
  nav_home_label: "首页",
  nav_nodes_label: "免费节点",
  nav_airport_label: "机场推荐",
  nav_archive_label: "文章归档",
  nav_about_label: "关于本站",
  nav_search_label: "搜索",
  home_section_badge: "最新发布",
  home_section_title: "最新节点分享",
  search_placeholder: "搜索日期、Clash、V2Ray…",
  search_button_text: "搜索",
  empty_title: "暂时还没有内容",
  empty_text: "第一篇更新发布后会显示在这里。",
  sidebar_latest_title: "最新文章",
  sidebar_hot_title: "热门内容",
  sidebar_tags_title: "常用标签",
  hero_read_button: "打开文章拿订阅",
  report_title_template: "{{date}} 免费节点更新｜今日整理 {{alive}} 条，Clash / V2Ray 订阅",
  report_excerpt_template: "今天共整理 {{alive}} 条：白名单源纯随机抽取 {{whitelist}} 条，普通节点通过真实隧道请求验证 {{verified}} 条。",
  report_body_template: "今天这批已经整理完了。共抓取 {{fetched}} 条配置，去重后处理 {{unique}} 条。白名单源跳过网络测活，纯随机抽取 {{whitelist}} 条直接进入订阅；普通节点配置检查通过 {{config}} 条，传输握手通过 {{transport}} 条，真正通过代理访问随机回显接口验证 {{verified}} 条；另有 {{trusted}} 条因历史成功记录暂时保留。最终有 {{alive}} 条进入订阅。\n\n## 怎么判断节点能不能用\n\n- 先检查 UUID、密码、端口、TLS、WS 路径等配置是否完整\n- 再按真实传输方式建立 TCP、TLS、WS 或 gRPC 连接\n- VLESS、Trojan、SOCKS5、HTTP 以及常见 AES-GCM Shadowsocks，会通过候选节点访问固定随机回显接口；随机令牌和出口 IP 都匹配才算真实验证\n- 检测过程不会直连兜底，也不会失败后切换其他节点，成功结果只属于当前这一条配置\n\n## CF 节点说明\n\n标准 Worker / Pages 域名会直接进行 WSS 和协议验证。优选 IP 与 Host/SNI 分离的配置，Cloudflare Worker 无法完全复现客户端链路，会单独标成待判断，避免直接误杀。\n\n## 本次结果\n\nCF 环境无法判断 {{unknown}} 条，验证失败或配置无效 {{dead}} 条。VMess、Reality、Hysteria2、TUIC 和带插件的 Shadowsocks 目前不会冒充真实可用。\n\n## 使用提醒\n\n- 优先导入今天文章里的订阅\n- 免费节点会随地区和运营商变化，遇到卡顿就切换\n- 白名单源依旧按你的设置纯随机抽取 1/3，不参加网络测活\n- 旧订阅 5 天后失效，请回到最新文章更新",
  subscription_kicker: "今日订阅",
  subscription_title: "复制链接，直接导入",
  subscription_description: "Clash 和 V2Ray 各一份，只对应这篇文章当天的节点，5 天后自动失效。",
  clash_button_text: "复制 Clash 订阅",
  v2ray_button_text: "复制 V2Ray 订阅",
  article_note_title: "先说两句",
  article_note_text: "免费节点随时会变。想看视频或冲 4K，先用当天更新，卡顿就换下一条。",
  source_fetch_concurrency: "6",
  source_timeout_ms: "20000",
  health_message_nodes: "20",
  health_concurrency: "5",
  health_timeout_ms: "2000",
  health_recheck_timeout_ms: "8000",
  health_quality_mode: "verified_only",
  trusted_cf_success_days: "5",
  trusted_cf_failure_limit: "3",
  source_low_quality_runs: "5",
  source_low_quality_verified_max: "1",
  source_auto_disable: "0",
  node_name_prefix: "Cactus",
  node_name_template: "{{country}} {{prefix}} {{index}}",
  subscription_group_name: "节点选择",
  category_nodes_description: "每天更新 Clash、V2Ray、小火箭免费订阅",
  category_airport_description: "想要 4K 秒开、晚高峰更稳，可以看这里",
  faq_section_badge: "常见问题",
  faq_section_title: "常见问题",
  report_stat_fetched_label: "抓取",
  report_stat_unique_label: "去重后",
  report_stat_alive_label: "今日保留",
  report_stat_dead_label: "已剔除",
  read_count_suffix: "次阅读",
  copy_link_text: "复制链接",
  footer_nav_title: "快速导航",
  footer_more_title: "更多",
  footer_rss_label: "RSS 订阅",
  site_logo_url: "",
  site_logo_letter: "C",
  theme_primary: "#2563eb",
  theme_ink: "#0f172a",
  theme_background: "#f4f7fb",
  theme_radius: "16",
  announcement_text: "今天的节点已更新，旧订阅保留 5 天，过期就回来拿新的。",
  announcement_link_text: "查看最新更新",
  home_featured_label: "今日更新",
  home_stats_title: "今天更新",
  home_stat_alive_label: "今日节点",
  home_stat_sources_label: "整理来源",
  home_stat_time_label: "更新时间",
  home_stat_validity_label: "链接保留",
  home_read_more_text: "阅读全文",
  home_view_all_text: "查看全部更新",
  sidebar_status_title: "今天更新了吗？",
  sidebar_status_text: "当天文章发布后，Clash 和 V2Ray 订阅会一起放在文末，链接保留 5 天。",
  telegram_cta: "加入频道",
  airport_sidebar_title: "想要 4K 秒开？",
  subscription_valid_days: "5",
  subscription_expiry_label: "有效期",
  subscription_expired_title: "这篇订阅已经过期",
  subscription_expired_text: "旧线路已经超过保留时间。请打开最新文章，获取今天重新整理的 Clash 和 V2Ray 订阅。",
  subscription_latest_cta: "去看最新更新",
  subscription_copy_text: "复制链接",
  subscription_copied_text: "已复制",
  article_prev_label: "上一篇",
  article_next_label: "下一篇",
  article_back_label: "返回文章列表",
  subscription_max_nodes: "0",
  subscription_shuffle: "0",
  about_body_text: `## 每天重新整理

旧线路不一直堆着，每天都会重新整理一批，失效的先清掉。

## 打开文章再拿订阅

每篇公开文章的末尾都会放对应的 Clash 和 V2Ray 订阅。昨天的链接只保留昨天那批，想拿新节点就看当天更新。

## 想冲 4K 就先试当天更新

线路表现会随地区变化，优先试最新一批，卡顿就切下一条。`,

};

const LEGACY_COPY_MIGRATIONS = [
  ["site_subtitle", "每日可用节点与订阅更新", DEFAULT_SETTINGS.site_subtitle],
  ["site_description", "每天自动抓取、去重并进行 10 秒连通性检测，只把本轮可连接的节点写入 Clash 与 V2Ray 订阅。", DEFAULT_SETTINGS.site_description],
  ["hero_badge", "东八区 · 每日自动更新", DEFAULT_SETTINGS.hero_badge],
  ["hero_title", "今天能连上的节点，", DEFAULT_SETTINGS.hero_title],
  ["hero_highlight", "已经替你筛好了", DEFAULT_SETTINGS.hero_highlight],
  ["hero_description", "节点池每天自动抓取、去重和测活。超过 10 秒仍无法建立连接的节点，不会进入当天订阅。", DEFAULT_SETTINGS.hero_description],
  ["hero_note", "不测延迟，不堆数量，只做每天都能重复执行的连通筛选。", DEFAULT_SETTINGS.hero_note],
  ["telegram_description", "订阅变动、临时通知和新源更新会优先发布在频道中。", DEFAULT_SETTINGS.telegram_description],
  ["airport_description", "追求高峰期稳定与 4K 高码率体验，可查看站长长期使用的线路。", DEFAULT_SETTINGS.airport_description],
  ["airport_badge", "高码率推荐", DEFAULT_SETTINGS.airport_badge],
  ["airport_cta", "查看稳定线路", DEFAULT_SETTINGS.airport_cta],
  ["site_subtitle", "每天一更，打开就能用", DEFAULT_SETTINGS.site_subtitle],
  ["site_description", "每天整理最新免费节点和常用客户端教程。订阅会先去重、测活，再统一发布。", DEFAULT_SETTINGS.site_description],
  ["hero_badge", "每日更新 · 免费分享", DEFAULT_SETTINGS.hero_badge],
  ["hero_title", "今天的免费节点，", DEFAULT_SETTINGS.hero_title],
  ["hero_highlight", "已经整理好了", DEFAULT_SETTINGS.hero_highlight],
  ["hero_description", "Clash、V2Ray 和小火箭常用格式都会整理。复制订阅，导入客户端即可使用。", DEFAULT_SETTINGS.hero_description],
  ["hero_note", "免费节点随时可能失效，建议收藏本站，使用前先看当天更新。", DEFAULT_SETTINGS.hero_note],
  ["about_text", "这是一个自动发布节点日报的轻量博客。原始节点池始终留在后台，公开页面只展示统计结果与筛选后的订阅。", DEFAULT_SETTINGS.about_text],
  ["airport_description", "免费节点适合临时用，长期看视频或高峰期使用，稳定线路会省心很多。", DEFAULT_SETTINGS.airport_description],
  ["airport_badge", "站长推荐", DEFAULT_SETTINGS.airport_badge],
  ["airport_cta", "查看详情", DEFAULT_SETTINGS.airport_cta],
  ["faq_1_q", "为什么订阅里还是可能有不能用的？", DEFAULT_SETTINGS.faq_1_q],
  ["faq_1_a", "本站做的是端口测活：10 秒内服务器有响应，就算通过本轮检查。它能清掉明显失联的配置，但不能替代完整协议、路径参数和真实出口测试。", DEFAULT_SETTINGS.faq_1_a],
  ["faq_2_q", "为什么不公开原始节点池？", DEFAULT_SETTINGS.faq_2_q],
  ["faq_2_a", "原始源地址、失效节点和来源关系只保存在后台，避免节点池被直接复制，也便于长期维护。", DEFAULT_SETTINGS.faq_2_a],
  ["faq_3_q", "订阅什么时候更新？", DEFAULT_SETTINGS.faq_3_q],
  ["faq_3_a", "系统默认每天东八区 16:00 开始测活，全部完成后等待 1 小时生成日报并同步刷新订阅。", DEFAULT_SETTINGS.faq_3_a],
  ["footer_text", "节点状态会随地区、运营商和时间变化，请以实际连接结果为准。", DEFAULT_SETTINGS.footer_text],
  ["theme_primary", "#ff5a36", DEFAULT_SETTINGS.theme_primary],
  ["theme_ink", "#121826", DEFAULT_SETTINGS.theme_ink],
  ["theme_background", "#f7f4ef", DEFAULT_SETTINGS.theme_background],
  ["theme_radius", "22", DEFAULT_SETTINGS.theme_radius],
  ["node_name_template", "{{prefix}} · {{protocol}} · {{index}}", DEFAULT_SETTINGS.node_name_template],
  ["site_subtitle", "每日更新｜Clash / V2Ray 订阅", DEFAULT_SETTINGS.site_subtitle],
  ["site_description", "每天重新整理一批免费节点，失效线路会在发布前清掉。Clash、V2Ray 订阅当天更新，打开就能复制。", DEFAULT_SETTINGS.site_description],
  ["hero_badge", "今日线路已经更新", DEFAULT_SETTINGS.hero_badge],
  ["hero_title", "冲 4K、刷视频，", DEFAULT_SETTINGS.hero_title],
  ["hero_highlight", "今天这批先试", DEFAULT_SETTINGS.hero_highlight],
  ["hero_description", "每天重新整理、去重，把失效线路先清掉。Clash 和 V2Ray 订阅已经备好，复制后直接导入。", DEFAULT_SETTINGS.hero_description],
  ["hero_note", "免费线路变化快，优先用当天更新；遇到卡顿，直接换下一条。", DEFAULT_SETTINGS.hero_note],
  ["report_title_template", "{{date}} 免费节点更新｜{{alive}}条已整理，Clash / V2Ray订阅", DEFAULT_SETTINGS.report_title_template],
  ["report_excerpt_template", "今天整理了{{alive}}条免费节点，失效线路已经清掉。Clash和V2Ray订阅都放在文章末尾。", DEFAULT_SETTINGS.report_excerpt_template],
  ["announcement_text", "每天更新一批新线路，旧订阅保留 5 天，过期后请回到最新文章。", DEFAULT_SETTINGS.announcement_text],
  ["sidebar_status_title", "今日状态", DEFAULT_SETTINGS.sidebar_status_title],
  ["sidebar_status_text", "节点会在发布前统一去重和测活。订阅只在对应文章里出现，并在 5 天后失效。", DEFAULT_SETTINGS.sidebar_status_text],
  ["report_title_template", "{{date}} 免费精选节点 {{alive}} 条｜Clash / V2Ray / 小火箭订阅", DEFAULT_SETTINGS.report_title_template],
  ["report_excerpt_template", "今天更新 {{alive}} 条免费节点，支持 Clash、V2Ray、小火箭。想看 1080P/4K，先试当天这批。", DEFAULT_SETTINGS.report_excerpt_template],
  ["report_body_template", "今天的节点已经更新，一共整理到 {{alive}} 条。支持 Clash、V2Ray 和小火箭常用格式，订阅放在文章末尾，复制后直接导入即可。\n\n## 今天这批怎么用\n\n想看 YouTube、流媒体或刷 4K，可以先试当天更新。不同地区、不同运营商表现会有差别，遇到卡顿直接换下一条，通常比一直等更快。\n\n## 本次整理\n\n本次共收集 {{fetched}} 条配置，去重后检查 {{unique}} 条，最后保留 {{alive}} 条，另外 {{dead}} 条已经清掉。\n\n## 使用提醒\n\n- 优先导入今天这篇文章里的订阅\n- 更新订阅后多切换几条线路试试\n- 免费节点变化快，旧订阅过期后回到最新文章\n- 想长期稳定使用，可以看看本站的机场推荐", DEFAULT_SETTINGS.report_body_template],
  ["report_title_template", "{{date}} 免费节点更新｜真实验证 {{verified}} 条，Clash / V2Ray 订阅", DEFAULT_SETTINGS.report_title_template],
  ["report_excerpt_template", "今天共检查 {{unique}} 条：真实代理验证 {{verified}} 条，可信 CF 白名单保留 {{trusted}} 条，最终订阅保留 {{alive}} 条。", DEFAULT_SETTINGS.report_excerpt_template],
];

const SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));
let schemaReadyPromise = null;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('url','text')),
    content TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_fetch_at INTEGER,
    last_fetch_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    public_alias TEXT,
    node_class TEXT NOT NULL DEFAULT 'auto',
    trusted_cf INTEGER NOT NULL DEFAULT 0,
    random_whitelist INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT NOT NULL UNIQUE,
    raw_uri TEXT,
    clash_json TEXT,
    name TEXT NOT NULL,
    protocol TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    tls INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    source_id INTEGER,
    updated_at INTEGER NOT NULL,
    last_checked_at INTEGER,
    last_alive INTEGER,
    last_result_level TEXT,
    last_transport_ok INTEGER,
    last_verified INTEGER,
    node_class TEXT NOT NULL DEFAULT 'unknown',
    last_verified_success_at INTEGER,
    consecutive_verify_failures INTEGER NOT NULL DEFAULT 0,
    consecutive_verify_successes INTEGER NOT NULL DEFAULT 0,
    last_probe_method TEXT,
    last_exit_ip TEXT,
    last_exit_loc TEXT,
    FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_key TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL DEFAULT 'daily',
    status TEXT NOT NULL,
    total_fetched INTEGER NOT NULL DEFAULT 0,
    total_unique INTEGER NOT NULL DEFAULT 0,
    tested INTEGER NOT NULL DEFAULT 0,
    alive INTEGER NOT NULL DEFAULT 0,
    dead INTEGER NOT NULL DEFAULT 0,
    config_pass INTEGER NOT NULL DEFAULT 0,
    transport_pass INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    transport_only INTEGER NOT NULL DEFAULT 0,
    cf_unknown INTEGER NOT NULL DEFAULT 0,
    invalid INTEGER NOT NULL DEFAULT 0,
    verify_failed INTEGER NOT NULL DEFAULT 0,
    trusted_retained INTEGER NOT NULL DEFAULT 0,
    whitelist_selected INTEGER NOT NULL DEFAULT 0,
    whitelist_skipped INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    report_due_at INTEGER,
    published_at INTEGER,
    error TEXT,
    admin_hidden INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS run_nodes (
    run_id INTEGER NOT NULL,
    node_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    config_ok INTEGER NOT NULL DEFAULT 0,
    transport_status TEXT,
    verify_status TEXT,
    result_level TEXT,
    node_class TEXT,
    trusted_source INTEGER NOT NULL DEFAULT 0,
    included_reason TEXT,
    probe_method TEXT,
    exit_ip TEXT,
    exit_loc TEXT,
    started_at INTEGER,
    checked_at INTEGER,
    PRIMARY KEY(run_id, node_id),
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL UNIQUE,
    date_key TEXT NOT NULL,
    title TEXT NOT NULL,
    summary_html TEXT NOT NULL,
    stats_json TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    published_at INTEGER,
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS report_meta (
    report_id INTEGER PRIMARY KEY,
    excerpt TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    cover_url TEXT,
    seo_title TEXT,
    seo_description TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    body_html TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '免费节点',
    tags_json TEXT NOT NULL DEFAULT '[]',
    cover_url TEXT,
    seo_title TEXT,
    seo_description TEXT,
    subscription_run_id INTEGER,
    published INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS content_views (
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(content_type, content_id)
  )`,
  `CREATE TABLE IF NOT EXISTS run_node_sources (
    run_id INTEGER NOT NULL,
    node_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    whitelist_selected INTEGER NOT NULL DEFAULT 0,
    whitelist_skipped INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(run_id, node_id, source_id),
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS source_run_stats (
    run_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    fetched_count INTEGER NOT NULL DEFAULT 0,
    unique_count INTEGER NOT NULL DEFAULT 0,
    config_pass INTEGER NOT NULL DEFAULT 0,
    transport_pass INTEGER NOT NULL DEFAULT 0,
    verified_count INTEGER NOT NULL DEFAULT 0,
    included_count INTEGER NOT NULL DEFAULT 0,
    exclusive_count INTEGER NOT NULL DEFAULT 0,
    cf_unknown_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    trusted_retained_count INTEGER NOT NULL DEFAULT 0,
    whitelist_selected_count INTEGER NOT NULL DEFAULT 0,
    whitelist_skipped_count INTEGER NOT NULL DEFAULT 0,
    direct_count INTEGER NOT NULL DEFAULT 0,
    cf_native_count INTEGER NOT NULL DEFAULT 0,
    cf_cdn_count INTEGER NOT NULL DEFAULT 0,
    unknown_type_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(run_id, source_id),
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
    FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_run_node_sources_source ON run_node_sources(run_id, source_id, node_id)`,
  `CREATE INDEX IF NOT EXISTS idx_source_run_stats_source ON source_run_stats(source_id, run_id DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_public ON articles(published, pinned, published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category, published, published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled)`,
  `CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status, report_due_at)`,
  `CREATE INDEX IF NOT EXISTS idx_run_nodes_status ON run_nodes(run_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_published ON reports(published, published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_report_meta_pinned ON report_meta(pinned, updated_at DESC)`,
];

export default {
  async fetch(request, env, ctx) {
    try {
      await ensureSchema(env);
      return await handleFetch(request, env, ctx);
    } catch (error) {
      console.error("fetch error", error);
      return jsonResponse({ ok: false, error: friendlyError(error) }, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureSchema(env);
      await schedulerTick(env);
    })());
  },

  async queue(batch, env, _ctx) {
    await ensureSchema(env);
    const prepareMessages = batch.messages.filter((m) => m.body?.type === "prepare_run");
    const checkMessages = batch.messages.filter((m) => ["health_check", "health_check_batch"].includes(m.body?.type));

    for (const message of prepareMessages) {
      try {
        await prepareRun(env, Number(message.body.runId));
        message.ack();
      } catch (error) {
        console.error("prepare queue error", error);
        await markRunError(env, Number(message.body.runId), friendlyError(error));
        message.retry({ delaySeconds: 60 });
      }
    }

    // 同一 invocation 内顺序处理消息；每条消息内部最多 5 个并发连接，
    // 给 D1 / KV 等操作留出余量，避免撞到 Workers 的 6 连接上限。
    for (const message of checkMessages) {
      try {
        await processHealthBatchMessage(env, message.body);
        message.ack();
      } catch (error) {
        console.error("health queue error", error);
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};

async function handleFetch(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/healthz") {
    return jsonResponse({ ok: true, version: APP_VERSION, time: Date.now() });
  }

  if (path === "/favicon.svg") return renderFaviconSvg();
  if (path === "/og.svg") return renderOgSvg(env);
  if (path === "/manifest.webmanifest") return renderManifest(env);

  if (path === "/api/admin/login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (path === "/api/admin/logout" && request.method === "POST") {
    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie": "cactus_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
        ...securityHeaders(),
      },
    });
  }

  if (path.startsWith("/api/admin/")) {
    if (!(await isAdminRequest(request, env))) {
      return jsonResponse({ ok: false, error: "未登录或会话已过期" }, 401);
    }
    if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request)) {
      return jsonResponse({ ok: false, error: "来源校验失败" }, 403);
    }
    return handleAdminApi(request, env, ctx, url);
  }

  if (path === "/api/public/home") {
    const query = String(url.searchParams.get("q") || "").trim();
    const page = clampNumber(url.searchParams.get("page"), 1, 9999, 1);
    return jsonResponse(await getPublicHomeData(env, url.origin, { query, page, category: String(url.searchParams.get("category") || "") }), 200, { "Cache-Control": "public, max-age=60" });
  }

  if (path === "/feed.xml") return renderRssFeed(env, url.origin);
  if (path === "/sitemap.xml") return renderSitemap(env, url.origin);
  if (path === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin/\nSitemap: ${url.origin}/sitemap.xml\n`, {
      headers: { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders() },
    });
  }

  if (path.startsWith("/sub/clash/")) {
    return serveSubscription(request, env, "clash");
  }

  if (path.startsWith("/sub/v2ray/")) {
    return serveSubscription(request, env, "v2ray");
  }

  if (path === "/admin") {
    return htmlResponse(adminHtml(), 200, { "Cache-Control": "no-store" });
  }

  if (path.startsWith("/report/")) {
    const dateKey = decodeURIComponent(path.slice("/report/".length));
    return renderReportPage(env, url.origin, dateKey, ctx);
  }

  if (path.startsWith("/article/")) {
    const slug=decodeURIComponent(path.slice("/article/".length));
    return renderArticlePage(env,url.origin,slug,ctx);
  }
  if (path.startsWith("/category/")) {
    const slug=decodeURIComponent(path.slice("/category/".length));
    return renderCategoryPage(env,url.origin,slug,url);
  }
  if (path === "/about") return renderAboutPage(env, url.origin);
  if (path === "/archive") return renderHomePage(env, url.origin, true, url);

  if (path === "/" || path === "/index.html") {
    return renderHomePage(env, url.origin, false, url);
  }

  return htmlResponse(notFoundHtml(), 404);
}

async function handleAdminApi(request, env, ctx, url) {
  const path = url.pathname;

  if (path === "/api/admin/state" && request.method === "GET") {
    return jsonResponse(await getAdminState(env, url.origin));
  }

  if (path === "/api/admin/settings" && request.method === "PUT") {
    const body = await readJson(request);
    const entries = Object.entries(body || {}).filter(([key]) => SETTING_KEYS.has(key));
    if (!entries.length) return jsonResponse({ ok: false, error: "没有可保存的设置" }, 400);

    validateSettings(Object.fromEntries(entries));
    await env.DB.batch(entries.map(([key, value]) => env.DB.prepare(
      `INSERT INTO settings(key, value) VALUES(?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`
    ).bind(key, String(value ?? ""))));
    return jsonResponse({ ok: true, settings: await getSettings(env) });
  }

  if (path === "/api/admin/backup" && request.method === "GET") {
    const [settings, sources, articles, reports, sourceStats] = await Promise.all([
      env.DB.prepare(`SELECT key,value FROM settings ORDER BY key`).all(),
      env.DB.prepare(`SELECT name,kind,content,enabled,node_class,trusted_cf,random_whitelist,created_at,updated_at FROM sources ORDER BY id`).all(),
      env.DB.prepare(`SELECT slug,title,excerpt,body_html,category,tags_json,cover_url,seo_title,seo_description,subscription_run_id,published,pinned,created_at,updated_at,published_at FROM articles ORDER BY id`).all(),
      env.DB.prepare(`SELECT r.date_key,r.title,r.summary_html,r.stats_json,r.published,r.created_at,r.published_at,
        COALESCE(m.excerpt,'') AS excerpt,COALESCE(m.pinned,0) AS pinned,COALESCE(m.cover_url,'') AS cover_url,
        COALESCE(m.seo_title,'') AS seo_title,COALESCE(m.seo_description,'') AS seo_description
        FROM reports r LEFT JOIN report_meta m ON m.report_id=r.id ORDER BY r.id`).all(),
      env.DB.prepare(`SELECT s.name AS source_name,r.date_key,srs.* FROM source_run_stats srs JOIN sources s ON s.id=srs.source_id JOIN runs r ON r.id=srs.run_id ORDER BY srs.run_id,srs.source_id`).all(),
    ]);
    return jsonResponse({
      ok: true,
      exported_at: Date.now(),
      version: APP_VERSION,
      settings: Object.fromEntries((settings.results || []).map((row) => [row.key, row.value])),
      sources: sources.results || [],
      articles: articles.results || [],
      reports: reports.results || [],
      source_stats: sourceStats.results || [],
    }, 200, { "Content-Disposition": `attachment; filename="cactus-backup-${shanghaiParts(Date.now()).dateKey}.json"` });
  }

  if (path === "/api/admin/sources/preview" && request.method === "POST") {
    const body = await readJson(request);
    const kind = body?.kind === "text" ? "text" : "url";
    const content = String(body?.content || "").trim();
    if (!content) return jsonResponse({ ok: false, error: "请先填写订阅地址或节点内容" }, 400);
    let raw = content;
    if (kind === "url") {
      const parsed = new URL(content);
      if (!["http:", "https:"].includes(parsed.protocol)) return jsonResponse({ ok: false, error: "只允许 HTTP/HTTPS 地址" }, 400);
      const settings = await getSettings(env);
      raw = await fetchTextWithTimeout(content, clampNumber(settings.source_timeout_ms, 5_000, 120_000, 20_000));
    }
    const nodes = await parseSourceContent(raw);
    const protocols = {};
    for (const node of nodes) protocols[node.protocol] = Number(protocols[node.protocol] || 0) + 1;
    return jsonResponse({
      ok: true,
      count: nodes.length,
      protocols,
      samples: nodes.slice(0, 8).map((node) => ({ name: node.name, protocol: node.protocol, host: node.host, port: node.port })),
    });
  }

  if (path === "/api/admin/sources/bulk" && request.method === "POST") {
    const body = await readJson(request);
    const lines = String(body?.text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return jsonResponse({ ok: false, error: "请粘贴订阅地址" }, 400);
    if (lines.length > 300) return jsonResponse({ ok: false, error: "单次最多导入 300 个订阅地址" }, 400);
    const now = Date.now();
    const rows = [];
    for (let i = 0; i < lines.length; i += 1) {
      const [left, ...rest] = lines[i].split("|");
      const hasName = rest.length > 0;
      const urlText = (hasName ? rest.join("|") : left).trim();
      const parsed = new URL(urlText);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`第 ${i + 1} 行不是 HTTP/HTTPS 地址`);
      const name = (hasName ? left.trim() : `节点源 ${String(i + 1).padStart(2, "0")}`).slice(0, 100);
      rows.push({ name, alias: cleanNodeName(name).slice(0, 60) || `源${i + 1}`, url: urlText });
    }
    let created = 0;
    for (const group of chunk(rows, 50)) {
      const result = await env.DB.batch(group.map((row) => env.DB.prepare(
        `INSERT INTO sources(name,public_alias,kind,content,enabled,node_class,trusted_cf,random_whitelist,created_at,updated_at)
         SELECT ?,?,'url',?,1,'auto',0,0,?,?
         WHERE NOT EXISTS(SELECT 1 FROM sources WHERE content=?)`
      ).bind(row.name, row.alias, row.url, now, now, row.url)));
      created += result.reduce((sum, item) => sum + Number(item.meta?.changes || 0), 0);
    }
    return jsonResponse({ ok: true, created, skipped: rows.length - created });
  }

  if (path === "/api/admin/sources" && request.method === "POST") {
    const body = await readJson(request);
    const source = validateSource(body);
    const now = Date.now();
    const result = await env.DB.prepare(
      `INSERT INTO sources(name, public_alias, kind, content, enabled, node_class, trusted_cf, random_whitelist, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(source.name, source.public_alias, source.kind, source.content, source.enabled ? 1 : 0, source.node_class, source.trusted_cf ? 1 : 0, source.random_whitelist ? 1 : 0, now, now).run();
    return jsonResponse({ ok: true, id: result.meta.last_row_id });
  }

  const sourceMatch = path.match(/^\/api\/admin\/sources\/(\d+)$/);
  if (sourceMatch && request.method === "PUT") {
    const id = Number(sourceMatch[1]);
    const body = await readJson(request);
    const source = validateSource(body);
    const result = await env.DB.prepare(
      `UPDATE sources SET name=?, public_alias=?, kind=?, content=?, enabled=?, node_class=?, trusted_cf=?, random_whitelist=?, updated_at=? WHERE id=?`
    ).bind(source.name, source.public_alias, source.kind, source.content, source.enabled ? 1 : 0, source.node_class, source.trusted_cf ? 1 : 0, source.random_whitelist ? 1 : 0, Date.now(), id).run();
    if (!result.meta.changes) return jsonResponse({ ok: false, error: "节点源不存在" }, 404);
    return jsonResponse({ ok: true });
  }

  if (sourceMatch && request.method === "DELETE") {
    const id = Number(sourceMatch[1]);
    await env.DB.prepare(`DELETE FROM sources WHERE id=?`).bind(id).run();
    return jsonResponse({ ok: true });
  }

  if (path === "/api/admin/run/start" && request.method === "POST") {
    const run = await createManualRun(env);
    ctx.waitUntil(env.NODE_QUEUE.send({ type: "prepare_run", runId: run.id }));
    return jsonResponse({ ok: true, run });
  }

  const publishMatch = path.match(/^\/api\/admin\/runs\/(\d+)\/publish$/);
  if (publishMatch && request.method === "POST") {
    const runId = Number(publishMatch[1]);
    const report = await publishRun(env, runId, url.origin, true);
    return jsonResponse({ ok: true, report });
  }

  const requeueMatch = path.match(/^\/api\/admin\/runs\/(\d+)\/requeue$/);
  if (requeueMatch && request.method === "POST") {
    const runId = Number(requeueMatch[1]);
    const queued = await enqueuePendingRunNodes(env, runId, true);
    return jsonResponse({ ok: true, queued });
  }

  const pauseMatch = path.match(/^\/api\/admin\/runs\/(\d+)\/pause$/);
  if (pauseMatch && request.method === "POST") {
    const runId = Number(pauseMatch[1]);
    const result = await pauseRun(env, runId);
    return jsonResponse({ ok: true, ...result });
  }

  const resumeMatch = path.match(/^\/api\/admin\/runs\/(\d+)\/resume$/);
  if (resumeMatch && request.method === "POST") {
    const runId = Number(resumeMatch[1]);
    const result = await resumeRun(env, runId);
    if (result.phase === "preparing") {
      ctx.waitUntil(env.NODE_QUEUE.send({ type: "prepare_run", runId }));
    } else {
      ctx.waitUntil(enqueuePendingRunNodes(env, runId, true));
    }
    return jsonResponse({ ok: true, ...result });
  }

  const deleteRunPostMatch = path.match(/^\/api\/admin\/runs\/(\d+)\/delete$/);
  if (deleteRunPostMatch && request.method === "POST") {
    const runId = Number(deleteRunPostMatch[1]);
    const result = await deleteRunRecord(env, runId);
    return jsonResponse({ ok: true, ...result });
  }

  const deleteRunMatch = path.match(/^\/api\/admin\/runs\/(\d+)$/);
  if (deleteRunMatch && request.method === "DELETE") {
    const runId = Number(deleteRunMatch[1]);
    const result = await deleteRunRecord(env, runId);
    return jsonResponse({ ok: true, ...result });
  }

  if (path === "/api/admin/articles" && request.method === "POST") {
    const body=await readJson(request); const article=validateArticle(body); const now=Date.now();
    if(article.published&&!env.SUB_TOKEN)throw new Error("请先配置 SUB_TOKEN，再公开文章");
    const subscriptionRunId=await resolveArticleRunId(env,article.subscription_run_id,article.published);
    const result=await env.DB.prepare(`INSERT INTO articles(slug,title,excerpt,body_html,category,tags_json,cover_url,seo_title,seo_description,subscription_run_id,published,pinned,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(article.slug,article.title,article.excerpt,textToSafeHtml(article.body_text),article.category,JSON.stringify(article.tags),article.cover_url,article.seo_title,article.seo_description,subscriptionRunId,article.published?1:0,article.pinned?1:0,now,now,article.published?now:null).run();
    return jsonResponse({ok:true,id:result.meta.last_row_id});
  }
  const duplicateArticleMatch=path.match(/^\/api\/admin\/articles\/(\d+)\/duplicate$/);
  if(duplicateArticleMatch && request.method==="POST"){
    const id=Number(duplicateArticleMatch[1]);
    const current=await env.DB.prepare(`SELECT * FROM articles WHERE id=?`).bind(id).first();
    if(!current)return jsonResponse({ok:false,error:"文章不存在"},404);
    const now=Date.now();
    const slug=`${safeSlug(current.slug||current.title)}-copy-${now.toString(36)}`;
    const result=await env.DB.prepare(`INSERT INTO articles(slug,title,excerpt,body_html,category,tags_json,cover_url,seo_title,seo_description,subscription_run_id,published,pinned,created_at,updated_at,published_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,0,0,?,?,NULL)`)
      .bind(slug,`${current.title}（副本）`,current.excerpt,current.body_html,current.category,current.tags_json,current.cover_url,current.seo_title,current.seo_description,current.subscription_run_id,now,now).run();
    return jsonResponse({ok:true,id:result.meta.last_row_id});
  }

  const articleMatch=path.match(/^\/api\/admin\/articles\/(\d+)$/);
  if(articleMatch && request.method==="PUT"){
    const id=Number(articleMatch[1]); const current=await env.DB.prepare(`SELECT * FROM articles WHERE id=?`).bind(id).first();
    if(!current)return jsonResponse({ok:false,error:"文章不存在"},404);
    const body=await readJson(request); const article=validateArticle(body,current); const now=Date.now();
    if(article.published&&!env.SUB_TOKEN)throw new Error("请先配置 SUB_TOKEN，再公开文章");
    const publishedAt=article.published?Number(current.published_at||now):null;
    const subscriptionRunId=await resolveArticleRunId(env,article.subscription_run_id,article.published);
    await env.DB.prepare(`UPDATE articles SET slug=?,title=?,excerpt=?,body_html=?,category=?,tags_json=?,cover_url=?,seo_title=?,seo_description=?,subscription_run_id=?,published=?,pinned=?,updated_at=?,published_at=? WHERE id=?`)
      .bind(article.slug,article.title,article.excerpt,textToSafeHtml(article.body_text),article.category,JSON.stringify(article.tags),article.cover_url,article.seo_title,article.seo_description,subscriptionRunId,article.published?1:0,article.pinned?1:0,now,publishedAt,id).run();
    return jsonResponse({ok:true});
  }
  if(articleMatch && request.method==="DELETE"){
    const id=Number(articleMatch[1]); await env.DB.batch([env.DB.prepare(`DELETE FROM articles WHERE id=?`).bind(id),env.DB.prepare(`DELETE FROM content_views WHERE content_type='article' AND content_id=?`).bind(id)]); return jsonResponse({ok:true});
  }

  const reportMatch = path.match(/^\/api\/admin\/reports\/(\d+)$/);
  if (reportMatch && request.method === "PUT") {
    const id = Number(reportMatch[1]);
    const current = await env.DB.prepare(`SELECT * FROM reports WHERE id=?`).bind(id).first();
    if (!current) return jsonResponse({ ok: false, error: "文章不存在" }, 404);
    const body = await readJson(request);
    const title = String(body?.title || "").trim().slice(0, 160);
    const bodyText = String(body?.body_text || "").trim().slice(0, 20_000);
    const excerpt = String(body?.excerpt || "").trim().slice(0, 300);
    const coverUrl = validateOptionalHttpUrl(body?.cover_url, "封面链接");
    const seoTitle = String(body?.seo_title || "").trim().slice(0, 160);
    const seoDescription = String(body?.seo_description || "").trim().slice(0, 300);
    if (!title) return jsonResponse({ ok: false, error: "文章标题不能为空" }, 400);
    if (!bodyText) return jsonResponse({ ok: false, error: "文章正文不能为空" }, 400);
    const published = body?.published === true ? 1 : 0;
    if (published && !env.SUB_TOKEN) return jsonResponse({ ok: false, error: "请先配置 SUB_TOKEN，再公开日报" }, 400);
    const pinned = body?.pinned === true ? 1 : 0;
    const now = Date.now();
    const publishedAt = published ? Number(current.published_at || now) : null;
    await env.DB.batch([
      env.DB.prepare(`UPDATE reports SET title=?, summary_html=?, published=?, published_at=? WHERE id=?`)
        .bind(title, textToSafeHtml(bodyText), published, publishedAt, id),
      env.DB.prepare(`INSERT INTO report_meta(report_id, excerpt, pinned, cover_url, seo_title, seo_description, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(report_id) DO UPDATE SET excerpt=excluded.excerpt, pinned=excluded.pinned, cover_url=excluded.cover_url, seo_title=excluded.seo_title, seo_description=excluded.seo_description, updated_at=excluded.updated_at`)
        .bind(id, excerpt, pinned, coverUrl, seoTitle, seoDescription, now),
      env.DB.prepare(`UPDATE runs SET status=?, published_at=? WHERE id=?`)
        .bind(published ? "published" : "hidden", publishedAt, current.run_id),
    ]);
    if (!published) await relinkArticlesFromRun(env, Number(current.run_id));
    await refreshLatestPublishedCache(env);
    return jsonResponse({ ok: true });
  }

  if (reportMatch && request.method === "DELETE") {
    const id = Number(reportMatch[1]);
    const report = await env.DB.prepare(`SELECT run_id FROM reports WHERE id=?`).bind(id).first();
    if (!report) return jsonResponse({ ok: false, error: "文章不存在" }, 404);
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM report_meta WHERE report_id=?`).bind(id),
      env.DB.prepare(`DELETE FROM reports WHERE id=?`).bind(id),
      env.DB.prepare(`UPDATE runs SET status='deleted', report_due_at=NULL, published_at=NULL WHERE id=?`).bind(report.run_id),
    ]);
    await relinkArticlesFromRun(env, Number(report.run_id));
    await Promise.all([
      deleteKvContent(env, `report:${report.run_id}:clash`),
      deleteKvContent(env, `report:${report.run_id}:v2ray`),
    ]);
    await refreshLatestPublishedCache(env);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "接口不存在" }, 404);
}

async function relinkArticlesFromRun(env, oldRunId) {
  const replacement = await env.DB.prepare(
    `SELECT run_id FROM reports WHERE published=1 AND run_id<>? ORDER BY published_at DESC LIMIT 1`
  ).bind(oldRunId).first();
  if (replacement?.run_id) {
    await env.DB.prepare(
      `UPDATE articles SET subscription_run_id=?, updated_at=? WHERE subscription_run_id=?`
    ).bind(Number(replacement.run_id), Date.now(), oldRunId).run();
  } else {
    await env.DB.prepare(
      `UPDATE articles SET published=0, published_at=NULL, updated_at=? WHERE subscription_run_id=?`
    ).bind(Date.now(), oldRunId).run();
  }
}

async function schedulerTick(env) {
  const settings = await getSettings(env);
  const now = Date.now();
  const local = shanghaiParts(now);
  const targetMinutes = parseTimeToMinutes(settings.daily_test_time);
  const currentMinutes = local.hour * 60 + local.minute;

  if (currentMinutes >= targetMinutes) {
    const existing = await env.DB.prepare(`SELECT id FROM runs WHERE date_key=?`).bind(local.date).first();
    const active = await env.DB.prepare(
      `SELECT id FROM runs WHERE status IN ('preparing','testing','paused_preparing','paused_testing') LIMIT 1`
    ).first();
    if (!existing && !active) {
      const run = await createRun(env, local.date, "daily");
      await env.NODE_QUEUE.send({ type: "prepare_run", runId: run.id });
    }
  }

  await recoverStaleChecks(env);

  if (settings.auto_publish === "1") {
    const due = await env.DB.prepare(
      `SELECT id FROM runs
       WHERE status='completed' AND report_due_at IS NOT NULL AND report_due_at<=?
       ORDER BY report_due_at ASC LIMIT 3`
    ).bind(now).all();
    for (const row of due.results || []) {
      try {
        await publishRun(env, row.id, "", false);
      } catch (error) {
        console.error("auto publish error", row.id, error);
      }
    }
  }
  await cleanupExpiredSubscriptionCaches(env, settings);
}

async function cleanupExpiredSubscriptionCaches(env, settings = null) {
  const marker = "maintenance:expired-subscriptions";
  if (await env.CACHE.get(marker)) return;
  await env.CACHE.put(marker, String(Date.now()), { expirationTtl: 21_600 });
  const config = settings || await getSettings(env);
  const cutoff = Date.now() - clampNumber(config.subscription_valid_days, 1, 30, 5) * DAY_MS;
  const expired = await env.DB.prepare(
    `SELECT run_id FROM reports WHERE published_at IS NOT NULL AND published_at<=? ORDER BY published_at DESC LIMIT 200`
  ).bind(cutoff).all();
  for (const row of expired.results || []) {
    await Promise.all([
      deleteKvContent(env, `report:${row.run_id}:clash`),
      deleteKvContent(env, `report:${row.run_id}:v2ray`),
    ]);
  }
}


async function pauseRun(env, runId) {
  const run = await env.DB.prepare(`SELECT id,status,date_key FROM runs WHERE id=?`).bind(runId).first();
  if (!run) throw new Error("任务不存在");

  if (run.status === "paused_preparing" || run.status === "paused_testing") {
    return { status: run.status, phase: run.status === "paused_preparing" ? "preparing" : "testing" };
  }

  if (run.status === "preparing") {
    await env.DB.prepare(
      `UPDATE runs SET status='paused_preparing', report_due_at=NULL WHERE id=? AND status='preparing'`
    ).bind(runId).run();
    return { status: "paused_preparing", phase: "preparing" };
  }

  if (run.status === "testing") {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE runs SET status='paused_testing', report_due_at=NULL WHERE id=? AND status='testing'`
      ).bind(runId),
      env.DB.prepare(
        `UPDATE run_nodes SET status='pending', started_at=NULL
         WHERE run_id=? AND status IN ('queued','checking')`
      ).bind(runId),
    ]);
    return { status: "paused_testing", phase: "testing" };
  }

  throw new Error("只有正在抓取或测活的任务可以临时终止");
}

async function resumeRun(env, runId) {
  const run = await env.DB.prepare(`SELECT id,status,date_key FROM runs WHERE id=?`).bind(runId).first();
  if (!run) throw new Error("任务不存在");

  if (run.status === "paused_preparing") {
    await env.DB.prepare(
      `UPDATE runs SET status='preparing', error=NULL, report_due_at=NULL WHERE id=? AND status='paused_preparing'`
    ).bind(runId).run();
    return { status: "preparing", phase: "preparing" };
  }

  if (run.status === "paused_testing") {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE runs SET status='testing', error=NULL, report_due_at=NULL WHERE id=? AND status='paused_testing'`
      ).bind(runId),
      env.DB.prepare(
        `UPDATE run_nodes SET status='pending', started_at=NULL
         WHERE run_id=? AND status IN ('queued','checking')`
      ).bind(runId),
    ]);
    return { status: "testing", phase: "testing" };
  }

  throw new Error("这个任务当前没有暂停");
}

async function deleteRunRecord(env, runId) {
  const run = await env.DB.prepare(`SELECT id,status,date_key FROM runs WHERE id=?`).bind(runId).first();
  if (!run) throw new Error("任务记录不存在");

  const report = await env.DB.prepare(`SELECT id FROM reports WHERE run_id=? LIMIT 1`).bind(runId).first();
  if (report) {
    // 已生成日报的任务只从后台任务列表隐藏，日报和对应订阅继续保留。
    await env.DB.prepare(
      `UPDATE runs SET admin_hidden=1 WHERE id=?`
    ).bind(runId).run();
    return { kept_report: true, stopped: false };
  }

  // 无论任务处于抓取、测活、暂停、异常还是待发布状态，都允许直接移除。
  // 先把状态改为 discarded，Queue 中尚未消费的旧消息读取到该状态后会自动跳过。
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE runs SET status='discarded', admin_hidden=1, report_due_at=NULL, error=NULL WHERE id=?`
    ).bind(runId),
    env.DB.prepare(`DELETE FROM run_nodes WHERE run_id=?`).bind(runId),
  ]);
  return { kept_report: false, stopped: ["preparing", "testing", "paused_preparing", "paused_testing"].includes(run.status) };
}

async function isRunInStatus(env, runId, statuses) {
  const run = await env.DB.prepare(`SELECT status FROM runs WHERE id=?`).bind(runId).first();
  return Boolean(run && statuses.includes(run.status));
}

async function createManualRun(env) {
  const active = await env.DB.prepare(
    `SELECT id, date_key FROM runs WHERE status IN ('preparing','testing','paused_preparing','paused_testing') ORDER BY created_at DESC LIMIT 1`
  ).first();
  if (active) throw new Error(`已有任务正在运行：${active.date_key}`);
  const local = shanghaiParts(Date.now());
  const dateKey = `${local.date}-manual-${local.hourString}${local.minuteString}${local.secondString}-${crypto.randomUUID().slice(0, 6)}`;
  return createRun(env, dateKey, "manual");
}

async function createRun(env, dateKey, mode) {
  const now = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO runs(date_key, mode, status, created_at) VALUES(?, ?, 'preparing', ?)`
  ).bind(dateKey, mode, now).run();
  return {
    id: Number(result.meta.last_row_id),
    date_key: dateKey,
    mode,
    status: "preparing",
    created_at: now,
  };
}

async function prepareRun(env, runId) {
  const run = await env.DB.prepare(`SELECT * FROM runs WHERE id=?`).bind(runId).first();
  if (!run) throw new Error("任务不存在");
  if (!["preparing", "error"].includes(run.status)) return;

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM run_nodes WHERE run_id=?`).bind(runId),
    env.DB.prepare(`DELETE FROM run_node_sources WHERE run_id=?`).bind(runId),
    env.DB.prepare(`DELETE FROM source_run_stats WHERE run_id=?`).bind(runId),
    env.DB.prepare(
      `UPDATE runs SET status='preparing', started_at=?, error=NULL,
       total_fetched=0, total_unique=0, tested=0, alive=0, dead=0,
       config_pass=0, transport_pass=0, verified=0, transport_only=0,
       cf_unknown=0, invalid=0, verify_failed=0, trusted_retained=0,
       whitelist_selected=0, whitelist_skipped=0,
       completed_at=NULL, report_due_at=NULL, published_at=NULL WHERE id=? AND status IN ('preparing','error')`
    ).bind(Date.now(), runId),
  ]);

  if (!(await isRunInStatus(env, runId, ["preparing"]))) return;

  const settings = await getSettings(env);
  const fetchConcurrency = clampNumber(settings.source_fetch_concurrency, 1, 10, 6);
  const now = Date.now();
  let totalFetched = 0;
  let lastSourceId = 0;

  // 先停用旧活动池，再按节点源分页抓取和写入；不把所有源、所有节点同时堆进内存。
  await env.DB.prepare(`UPDATE nodes SET enabled=0`).run();
  while (true) {
    if (!(await isRunInStatus(env, runId, ["preparing"]))) return;
    const sourcePage = await env.DB.prepare(
      `SELECT * FROM sources WHERE enabled=1 AND id>? ORDER BY id ASC LIMIT ?`
    ).bind(lastSourceId, fetchConcurrency).all();
    const sourceRows = sourcePage.results || [];
    if (!sourceRows.length) break;
    const results = await Promise.all(sourceRows.map((source) => loadSource(env, source, settings)));
    if (!(await isRunInStatus(env, runId, ["preparing"]))) return;
    for (const result of results) {
      if (!(await isRunInStatus(env, runId, ["preparing"]))) return;
      totalFetched += result.nodes.length;
      await upsertSourceNodes(env, result.nodes, result.sourceId, now, runId);
    }
    lastSourceId = Number(sourceRows[sourceRows.length - 1].id);
  }

  if (!(await isRunInStatus(env, runId, ["preparing"]))) return;
  const uniqueRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM nodes WHERE enabled=1`).first();
  const totalUnique = Number(uniqueRow?.count || 0);

  if (!totalUnique) {
    const completedAt = Date.now();
    const dueAt = completedAt + clampNumber(settings.report_delay_minutes, 1, 1440, 60) * 60_000;
    await env.DB.prepare(
      `UPDATE runs SET status='completed', total_fetched=?, total_unique=0, tested=0,
       alive=0, dead=0, config_pass=0, transport_pass=0, verified=0,
       transport_only=0, cf_unknown=0, invalid=0, verify_failed=0, trusted_retained=0,
       whitelist_selected=0, whitelist_skipped=0,
       completed_at=?, report_due_at=? WHERE id=?`
    ).bind(totalFetched, completedAt, dueAt, runId).run();
    return;
  }

  // 用一条 INSERT...SELECT 建立本轮节点关系，避免节点越多时产生海量逐条插入。
  await env.DB.prepare(
    `INSERT OR IGNORE INTO run_nodes(run_id, node_id, status)
     SELECT ?, id, 'pending' FROM nodes WHERE enabled=1`
  ).bind(runId).run();
  const whitelistResult = await applyRandomWhitelistSources(env, runId);
  await env.DB.prepare(
    `UPDATE runs SET status='testing', total_fetched=?, total_unique=?, tested=?, alive=?, dead=0,
     config_pass=?, transport_pass=0, verified=0, transport_only=0,
     cf_unknown=0, invalid=0, verify_failed=0, trusted_retained=0,
     whitelist_selected=?, whitelist_skipped=?
     WHERE id=? AND status='preparing'`
  ).bind(
    totalFetched,
    totalUnique,
    whitelistResult.selected + whitelistResult.skipped,
    whitelistResult.selected,
    whitelistResult.selected + whitelistResult.skipped,
    whitelistResult.selected,
    whitelistResult.skipped,
    runId,
  ).run();
  if (!(await isRunInStatus(env, runId, ["testing"]))) return;

  // 分页读取 ID 并推送到 Queue，不把完整 ID 列表一次性堆在内存中。
  let lastId = 0;
  while (true) {
    if (!(await isRunInStatus(env, runId, ["testing"]))) return;
    const page = await env.DB.prepare(
      `SELECT node_id FROM run_nodes WHERE run_id=? AND node_id>? AND status='pending'
       ORDER BY node_id ASC LIMIT 5000`
    ).bind(runId, lastId).all();
    const ids = (page.results || []).map((row) => Number(row.node_id));
    if (!ids.length) break;
    await enqueueHealthMessages(env, runId, ids, settings);
    lastId = ids[ids.length - 1];
  }
  await finalizeRunIfDone(env, runId);
}


function secureRandomInt(maxExclusive) {
  const max = Number(maxExclusive);
  if (!Number.isInteger(max) || max <= 0) return 0;
  const range = 0x100000000;
  const limit = range - (range % max);
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % max;
}

function secureShuffle(values) {
  const output = [...values];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

async function applyRandomWhitelistSources(env, runId) {
  const sources = await env.DB.prepare(
    `SELECT id FROM sources WHERE enabled=1 AND COALESCE(random_whitelist,0)=1 ORDER BY id`
  ).all();
  const whitelistSources = sources.results || [];
  if (!whitelistSources.length) return { selected: 0, skipped: 0 };

  const now = Date.now();
  for (const source of whitelistSources) {
    const rows = await env.DB.prepare(
      `SELECT node_id FROM run_node_sources WHERE run_id=? AND source_id=? ORDER BY node_id`
    ).bind(runId, source.id).all();
    const ids = [...new Set((rows.results || []).map((row) => Number(row.node_id)).filter(Boolean))];
    if (!ids.length) continue;

    // 纯随机：每次任务都重新洗牌，不使用日期种子，也不保证与上次结果一致。
    const shuffled = secureShuffle(ids);
    const take = Math.max(1, Math.floor(shuffled.length / 3));
    const selectedIds = shuffled.slice(0, take);

    await env.DB.prepare(
      `UPDATE run_node_sources SET whitelist_selected=0, whitelist_skipped=1
       WHERE run_id=? AND source_id=?`
    ).bind(runId, source.id).run();

    for (const group of chunk(selectedIds, 80)) {
      if (!group.length) continue;
      const placeholders = group.map(() => "?").join(",");
      await env.DB.prepare(
        `UPDATE run_node_sources SET whitelist_selected=1, whitelist_skipped=0
         WHERE run_id=? AND source_id=? AND node_id IN (${placeholders})`
      ).bind(runId, source.id, ...group).run();
    }
  }

  // 任何一个白名单源抽中的节点都直接进入本轮订阅，不再进入网络测活队列。
  await env.DB.prepare(
    `UPDATE run_nodes SET
       status='alive',
       error=NULL,
       config_ok=1,
       transport_status='skipped',
       verify_status='skipped',
       result_level='whitelist_random',
       trusted_source=1,
       included_reason='whitelist_random',
       checked_at=?,
       started_at=NULL
     WHERE run_id=? AND status='pending'
       AND EXISTS(
         SELECT 1 FROM run_node_sources rns
         WHERE rns.run_id=run_nodes.run_id
           AND rns.node_id=run_nodes.node_id
           AND rns.whitelist_selected=1
       )`
  ).bind(now, runId).run();

  // 只来自白名单源、但本次没有抽中的节点直接结束本轮，不测活、不进入订阅。
  // 若同一节点也存在于普通节点源，则仍保留 pending，交给普通三步算法处理。
  await env.DB.prepare(
    `UPDATE run_nodes SET
       status='skipped',
       error='白名单源本轮未被随机抽中',
       config_ok=1,
       transport_status='skipped',
       verify_status='skipped',
       result_level='whitelist_skipped',
       trusted_source=1,
       included_reason='whitelist_not_selected',
       checked_at=?,
       started_at=NULL
     WHERE run_id=? AND status='pending'
       AND EXISTS(
         SELECT 1 FROM run_node_sources rns
         JOIN sources s ON s.id=rns.source_id
         WHERE rns.run_id=run_nodes.run_id
           AND rns.node_id=run_nodes.node_id
           AND COALESCE(s.random_whitelist,0)=1
       )
       AND NOT EXISTS(
         SELECT 1 FROM run_node_sources rns
         JOIN sources s ON s.id=rns.source_id
         WHERE rns.run_id=run_nodes.run_id
           AND rns.node_id=run_nodes.node_id
           AND COALESCE(s.random_whitelist,0)=0
       )`
  ).bind(now, runId).run();

  const counts = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN included_reason='whitelist_random' THEN 1 ELSE 0 END) AS selected,
       SUM(CASE WHEN included_reason='whitelist_not_selected' THEN 1 ELSE 0 END) AS skipped
     FROM run_nodes WHERE run_id=?`
  ).bind(runId).first();
  return {
    selected: Number(counts?.selected || 0),
    skipped: Number(counts?.skipped || 0),
  };
}

async function upsertSourceNodes(env, nodes, sourceId, now, runId) {
  const local = new Map();
  for (const node of nodes || []) {
    if (node?.fingerprint && !local.has(node.fingerprint)) local.set(node.fingerprint, node);
  }
  for (const group of chunk([...local.values()], 40)) {
    await env.DB.batch(group.map((node) => env.DB.prepare(
      `INSERT INTO nodes(
        fingerprint, raw_uri, clash_json, name, protocol, host, port, tls, enabled, source_id, updated_at
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(fingerprint) DO UPDATE SET
        raw_uri=excluded.raw_uri,
        clash_json=excluded.clash_json,
        name=excluded.name,
        protocol=excluded.protocol,
        host=excluded.host,
        port=excluded.port,
        tls=excluded.tls,
        enabled=1,
        source_id=excluded.source_id,
        updated_at=excluded.updated_at`
    ).bind(
      node.fingerprint,
      node.raw_uri || null,
      node.clash_json || null,
      node.name,
      node.protocol,
      node.host,
      node.port,
      node.tls ? 1 : 0,
      sourceId || null,
      now,
    )));
  }
  if (runId && sourceId) {
    await env.DB.prepare(
      `INSERT INTO source_run_stats(run_id,source_id,fetched_count,created_at)
       VALUES(?,?,?,?)
       ON CONFLICT(run_id,source_id) DO UPDATE SET
         fetched_count=excluded.fetched_count, created_at=excluded.created_at`
    ).bind(runId, sourceId, (nodes || []).length, now).run();
    const fingerprints = [...local.keys()];
    for (const group of chunk(fingerprints, 80)) {
      if (!group.length) continue;
      const placeholders = group.map(() => "?").join(",");
      const rows = await env.DB.prepare(
        `SELECT id FROM nodes WHERE fingerprint IN (${placeholders})`
      ).bind(...group).all();
      const ids = (rows.results || []).map((row) => Number(row.id)).filter(Boolean);
      for (const idGroup of chunk(ids, 40)) {
        await env.DB.batch(idGroup.map((nodeId) => env.DB.prepare(
          `INSERT OR IGNORE INTO run_node_sources(run_id,node_id,source_id) VALUES(?,?,?)`
        ).bind(runId, nodeId, sourceId)));
      }
    }
  }
}

async function loadSource(env, source, settings = null) {
  let text = source.content;
  let error = null;
  let nodes = [];
  try {
    if (source.kind === "url") {
      text = await fetchTextWithTimeout(source.content, clampNumber(settings?.source_timeout_ms, 5_000, 120_000, 20_000));
    }
    nodes = await parseSourceContent(text);
  } catch (err) {
    error = friendlyError(err).slice(0, 500);
  }

  await env.DB.prepare(
    `UPDATE sources SET last_fetch_at=?, last_fetch_count=?, last_error=? WHERE id=?`
  ).bind(Date.now(), nodes.length, error, source.id).run();

  return { sourceId: Number(source.id), nodes, error };
}

async function enqueueHealthMessages(env, runId, nodeIds, settings = null) {
  const run = await env.DB.prepare(`SELECT status FROM runs WHERE id=?`).bind(runId).first();
  if (!run || run.status !== "testing") return 0;
  const config = settings || await getSettings(env);
  const perMessage = clampNumber(config.health_message_nodes, 5, 25, 20);
  const uniqueIds = [...new Set(nodeIds.map(Number).filter(Boolean))];
  const queuedAt = Date.now();
  const messages = chunk(uniqueIds, perMessage).map((ids) => ({
    body: { type: "health_check_batch", runId, nodeIds: ids },
  }));
  for (const group of chunk(messages, 100)) {
    await env.NODE_QUEUE.sendBatch(group);
  }
  const activeRun = await env.DB.prepare(`SELECT status FROM runs WHERE id=?`).bind(runId).first();
  if (!activeRun || activeRun.status !== "testing") return 0;
  // 发送成功后再标记 queued；消费者同时到达时，WHERE pending 可避免覆盖 checking/alive/dead。
  for (const ids of chunk(uniqueIds, 90)) {
    if (!ids.length) continue;
    const placeholders = ids.map(() => "?").join(",");
    await env.DB.prepare(
      `UPDATE run_nodes SET status='queued', started_at=?
       WHERE run_id=? AND status='pending' AND node_id IN (${placeholders})`
    ).bind(queuedAt, runId, ...ids).run();
  }
  return uniqueIds.length;
}

async function enqueuePendingRunNodes(env, runId, includeWorking = false) {
  const run = await env.DB.prepare(`SELECT status FROM runs WHERE id=?`).bind(runId).first();
  if (!run || run.status !== "testing") return 0;
  if (includeWorking) {
    await env.DB.prepare(
      `UPDATE run_nodes SET status='pending', started_at=NULL
       WHERE run_id=? AND status IN ('checking','queued')`
    ).bind(runId).run();
  }
  let queued = 0;
  let lastId = 0;
  while (true) {
    const current = await env.DB.prepare(`SELECT status FROM runs WHERE id=?`).bind(runId).first();
    if (!current || current.status !== "testing") break;
    const rows = await env.DB.prepare(
      `SELECT node_id FROM run_nodes
       WHERE run_id=? AND status='pending' AND node_id>?
       ORDER BY node_id ASC LIMIT 5000`
    ).bind(runId, lastId).all();
    const ids = (rows.results || []).map((row) => Number(row.node_id));
    if (!ids.length) break;
    await enqueueHealthMessages(env, runId, ids);
    queued += ids.length;
    lastId = ids[ids.length - 1];
  }
  return queued;
}

async function recoverStaleChecks(env) {
  const checkingCutoff = Date.now() - 2 * 60_000;
  const queuedCutoff = Date.now() - 3 * 60_000;
  const stale = await env.DB.prepare(
    `SELECT rn.run_id, rn.node_id FROM run_nodes rn
     JOIN runs r ON r.id=rn.run_id
     WHERE r.status='testing'
       AND ((rn.status='checking' AND rn.started_at<?)
         OR (rn.status='queued' AND rn.started_at<?))
     LIMIT 1000`
  ).bind(checkingCutoff, queuedCutoff).all();

  if (stale.results?.length) {
    await env.DB.batch(stale.results.map((row) => env.DB.prepare(
      `UPDATE run_nodes SET status='pending', started_at=NULL
       WHERE run_id=? AND node_id=? AND status IN ('checking','queued')`
    ).bind(row.run_id, row.node_id)));
    const byRun = new Map();
    for (const row of stale.results) {
      if (!byRun.has(row.run_id)) byRun.set(row.run_id, []);
      byRun.get(row.run_id).push(Number(row.node_id));
    }
    for (const [runId, ids] of byRun) await enqueueHealthMessages(env, Number(runId), ids);
  }

  const waitingRuns = await env.DB.prepare(
    `SELECT id FROM runs WHERE status='testing' ORDER BY created_at DESC LIMIT 5`
  ).all();
  for (const run of waitingRuns.results || []) {
    const pending = await env.DB.prepare(
      `SELECT node_id FROM run_nodes WHERE run_id=? AND status='pending' ORDER BY node_id LIMIT 2000`
    ).bind(run.id).all();
    const ids = (pending.results || []).map((row) => Number(row.node_id));
    if (ids.length) await enqueueHealthMessages(env, Number(run.id), ids);
    await finalizeRunIfDone(env, Number(run.id));
  }
}

async function processHealthBatchMessage(env, body) {
  const runId = Number(body?.runId);
  const requestedIds = Array.isArray(body?.nodeIds) ? body.nodeIds : [body?.nodeId];
  const nodeIds = [...new Set(requestedIds.map(Number).filter(Boolean))].slice(0, 25);
  if (!runId || !nodeIds.length) return;

  const run = await env.DB.prepare(`SELECT status FROM runs WHERE id=?`).bind(runId).first();
  if (!run || run.status !== "testing") return;

  const startedAt = Date.now();
  const claims = await env.DB.batch(nodeIds.map((nodeId) => env.DB.prepare(
    `UPDATE run_nodes SET status='checking', started_at=?
     WHERE run_id=? AND node_id=? AND status IN ('pending','queued')`
  ).bind(startedAt, runId, nodeId)));
  const claimedIds = nodeIds.filter((_, index) => Number(claims[index]?.meta?.changes || 0) > 0);
  if (!claimedIds.length) return;

  try {
    const placeholders = claimedIds.map(() => "?").join(",");
    const [rows, sourceRows, settings] = await Promise.all([
      env.DB.prepare(`SELECT * FROM nodes WHERE enabled=1 AND id IN (${placeholders})`).bind(...claimedIds).all(),
      env.DB.prepare(
        `SELECT rns.node_id,s.id AS source_id,s.node_class,s.trusted_cf,s.random_whitelist
         FROM run_node_sources rns JOIN sources s ON s.id=rns.source_id
         WHERE rns.run_id=? AND rns.node_id IN (${placeholders})`
      ).bind(runId, ...claimedIds).all(),
      getSettings(env),
    ]);
    const nodeMap = new Map((rows.results || []).map((node) => [Number(node.id), node]));
    const sourceProfiles = new Map();
    for (const row of sourceRows.results || []) {
      const id = Number(row.node_id);
      if (!sourceProfiles.has(id)) sourceProfiles.set(id, []);
      sourceProfiles.get(id).push({
        sourceId: Number(row.source_id),
        nodeClass: String(row.node_class || "auto"),
        trustedCf: Number(row.trusted_cf || 0) === 1,
        randomWhitelist: Number(row.random_whitelist || 0) === 1,
      });
    }
    const concurrency = clampNumber(settings.health_concurrency, 1, 5, 5);
    const qualityMode = normalizeQualityMode(settings.health_quality_mode);

    const results = await mapLimit(claimedIds, concurrency, async (nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node) return {
        nodeId, node: null, level: "invalid", configOk: false, transportOk: false, verified: false,
        verifyAttempted: false, error: "节点不存在或已停用", nodeClass: "unknown", trustedSource: false,
        included: false, includedReason: "missing", nextLastSuccessAt: 0, nextFailures: 0, nextSuccesses: 0,
      };
      const profiles = sourceProfiles.get(nodeId) || [];
      const actual = await checkNodeThreeStage(node, settings, profiles);
      const decision = applyNodeInclusionPolicy(node, actual, settings, profiles, qualityMode);
      return { nodeId, node, ...actual, ...decision };
    });

    const activeRun = await env.DB.prepare(`SELECT status FROM runs WHERE id=?`).bind(runId).first();
    if (!activeRun || activeRun.status !== "testing") {
      for (const ids of chunk(claimedIds, 90)) {
        const list = ids.map(() => "?").join(",");
        await env.DB.prepare(
          `UPDATE run_nodes SET status='pending', started_at=NULL
           WHERE run_id=? AND node_id IN (${list}) AND status='checking'`
        ).bind(runId, ...ids).run();
      }
      return;
    }

    const checkedAt = Date.now();
    const aliveCount = results.filter((item) => item.included).length;
    const configPass = results.filter((item) => item.configOk).length;
    const transportPass = results.filter((item) => item.transportOk).length;
    const verifiedCount = results.filter((item) => item.verified).length;
    const transportOnly = results.filter((item) => item.level === "transport").length;
    const cfUnknown = results.filter((item) => item.level === "cf_unknown").length;
    const invalidCount = results.filter((item) => item.level === "invalid").length;
    const verifyFailed = results.filter((item) => item.level === "verify_failed" || item.level === "transport_failed").length;
    const trustedRetained = results.filter((item) => String(item.includedReason || "").startsWith("trusted_")).length;
    const statements = [];
    for (const item of results) {
      statements.push(env.DB.prepare(
        `UPDATE run_nodes SET status=?, error=?, config_ok=?, transport_status=?, verify_status=?, result_level=?,
         node_class=?, trusted_source=?, included_reason=?, probe_method=?, exit_ip=?, exit_loc=?, checked_at=?, started_at=NULL
         WHERE run_id=? AND node_id=?`
      ).bind(
        item.included ? "alive" : "dead",
        item.error ? String(item.error).slice(0, 500) : null,
        item.configOk ? 1 : 0,
        item.transportOk ? "passed" : (item.level === "cf_unknown" ? "unknown" : "failed"),
        item.verified ? "passed" : (item.verifyAttempted ? "failed" : "not_supported"),
        item.level,
        item.nodeClass || "unknown",
        item.trustedSource ? 1 : 0,
        item.includedReason || null,
        item.probeMethod || null,
        item.exitIp || null,
        item.exitLoc || null,
        checkedAt,
        runId,
        item.nodeId,
      ));
      if (item.node) {
        statements.push(env.DB.prepare(
          `UPDATE nodes SET last_checked_at=?, last_alive=?, last_result_level=?, last_transport_ok=?, last_verified=?,
           node_class=?, last_verified_success_at=?, consecutive_verify_failures=?, consecutive_verify_successes=?,
           last_probe_method=?, last_exit_ip=?, last_exit_loc=?
           WHERE id=?`
        ).bind(
          checkedAt,
          item.included ? 1 : 0,
          item.level,
          item.transportOk ? 1 : 0,
          item.verified ? 1 : 0,
          item.nodeClass || "unknown",
          item.nextLastSuccessAt || null,
          item.nextFailures || 0,
          item.nextSuccesses || 0,
          item.probeMethod || null,
          item.exitIp || null,
          item.exitLoc || null,
          item.nodeId,
        ));
      }
    }
    statements.push(env.DB.prepare(
      `UPDATE runs SET tested=tested+?, alive=alive+?, dead=dead+?,
       config_pass=config_pass+?, transport_pass=transport_pass+?, verified=verified+?,
       transport_only=transport_only+?, cf_unknown=cf_unknown+?, invalid=invalid+?, verify_failed=verify_failed+?,
       trusted_retained=trusted_retained+?
       WHERE id=? AND status='testing'`
    ).bind(results.length, aliveCount, results.length - aliveCount, configPass, transportPass, verifiedCount,
      transportOnly, cfUnknown, invalidCount, verifyFailed, trustedRetained, runId));
    await env.DB.batch(statements);
    await finalizeRunIfDone(env, runId);
  } catch (error) {
    for (const ids of chunk(claimedIds, 90)) {
      const placeholders = ids.map(() => "?").join(",");
      await env.DB.prepare(
        `UPDATE run_nodes SET status='pending', started_at=NULL
         WHERE run_id=? AND status='checking' AND node_id IN (${placeholders})`
      ).bind(runId, ...ids).run().catch(() => {});
    }
    throw error;
  }
}
async function finalizeRunIfDone(env, runId) {
  const counts = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status IN ('pending','queued','checking') THEN 1 ELSE 0 END) AS remaining,
       COUNT(*) AS total
     FROM run_nodes WHERE run_id=?`
  ).bind(runId).first();
  if (!counts || Number(counts.remaining || 0) > 0) return;

  const run = await env.DB.prepare(`SELECT status FROM runs WHERE id=?`).bind(runId).first();
  if (!run || run.status !== "testing") return;

  const settings = await getSettings(env);
  await refreshSourceRunStats(env, runId, settings);
  const completedAt = Date.now();
  const delayMinutes = clampNumber(settings.report_delay_minutes, 1, 1440, 60);
  const dueAt = completedAt + delayMinutes * 60_000;
  await env.DB.prepare(
    `UPDATE runs SET status='completed', completed_at=?, report_due_at=? WHERE id=? AND status='testing'`
  ).bind(completedAt, dueAt, runId).run();
}

function normalizeQualityMode(value) {
  return ["verified_only", "verified_and_transport", "all_nonfailed"].includes(String(value)) ? String(value) : "verified_only";
}

function qualityLevelIncluded(level, mode) {
  if (level === "verified") return true;
  if (mode === "verified_and_transport" && level === "transport") return true;
  if (mode === "all_nonfailed" && ["transport", "cf_unknown"].includes(level)) return true;
  return false;
}

async function checkNodeThreeStage(node, settings = DEFAULT_SETTINGS, profiles = []) {
  const config = validateNodeConfiguration(node);
  const nodeClass = classifyNodeKind(node, config.proxy || null, profiles);
  if (!config.ok) {
    return { level: "invalid", configOk: false, transportOk: false, verified: false, verifyAttempted: false, error: config.error, nodeClass };
  }

  const quickMs = clampNumber(settings.health_timeout_ms, 1_000, 10_000, DEFAULT_CHECK_TIMEOUT_MS);
  const first = await probeNodeAttempt(node, config.proxy, nodeClass, quickMs);
  if (!shouldExtendedRecheck(node, config.proxy, nodeClass, profiles, first)) {
    return { configOk: true, nodeClass, ...first };
  }

  const recheckMs = clampNumber(settings.health_recheck_timeout_ms, 2_000, 15_000, 8_000);
  const second = await probeNodeAttempt(node, config.proxy, nodeClass, recheckMs);
  if (second.verified || second.level === "transport") {
    return {
      configOk: true,
      nodeClass,
      ...second,
      error: second.error ? `快速检查未通过，复检结果：${second.error}` : null,
      rechecked: true,
    };
  }

  // 两次均失败时，以复检结果为准，但保留“已复检”信息，方便后台判断不是 2 秒快筛误杀。
  return {
    configOk: true,
    nodeClass,
    ...second,
    error: `快速检查 ${quickMs}ms 未通过；复检 ${recheckMs}ms：${second.error || "未通过"}`,
    rechecked: true,
  };
}

async function probeNodeAttempt(node, proxy, nodeClass, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  try {
    return await probeNodeByClass(node, proxy, nodeClass, deadline);
  } catch (error) {
    const message = friendlyError(error);
    const stage = error?.probeStage || "transport";
    if (isCloudflareSocketRestriction(message)) {
      return {
        level: "cf_unknown",
        transportOk: false,
        verified: false,
        verifyAttempted: false,
        error: "Cloudflare 环境无法判断：" + message,
      };
    }
    return {
      level: stage === "verify" ? "verify_failed" : "transport_failed",
      transportOk: stage === "verify",
      verified: false,
      verifyAttempted: stage === "verify",
      error: Date.now() >= deadline ? `检查超过 ${timeoutMs}ms` : message,
    };
  }
}

function shouldExtendedRecheck(node, proxy, nodeClass, profiles, first) {
  if (!first || first.verified || first.level === "transport" || first.level === "invalid") return false;
  // Cloudflare 明确拒绝自身 TCP 目标时，延长时间没有意义。
  if (first.level === "cf_unknown" && String(first.error || "").includes("Cloudflare 环境无法判断")) return false;
  const network = String(proxy?.network || "tcp").toLowerCase();
  const tls = Boolean(proxy?.tls || proxy?.sni || proxy?.servername || node?.tls);
  const historical = Number(node?.last_alive || 0) === 1 || Number(node?.last_verified_success_at || 0) > 0;
  const protectedSource = (profiles || []).some((item) => item.trustedCf);
  return historical || protectedSource || ["cf_native", "cf_cdn"].includes(nodeClass) || tls || ["ws", "grpc"].includes(network);
}

function classifyNodeKind(node, proxy, profiles = []) {
  const server = String(node?.host || proxy?.server || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const network = String(proxy?.network || "tcp").toLowerCase();
  const wsHost = getWebSocketHost(proxy).toLowerCase().replace(/\.$/, "");
  const sni = String(proxy?.servername || proxy?.sni || "").toLowerCase().replace(/\.$/, "");
  const routeHost = wsHost || sni;
  const workerDomain = [server, routeHost].find((value) => /(^|\.)(workers\.dev|pages\.dev)$/.test(value));
  if (workerDomain) return "cf_native";

  const secure = Boolean(proxy?.tls || proxy?.servername || proxy?.sni || node?.tls || Number(node?.port) === 443);
  if (network === "ws" && secure && routeHost && routeHost !== server) return "cf_cdn";

  // 源级类型仅作为无法从节点本身判断时的提示，不再覆盖混合订阅里的每一条节点。
  const explicit = [...new Set((profiles || []).map((item) => String(item.nodeClass || "auto")).filter((value) => value !== "auto"))];
  if (explicit.length === 1 && ["direct", "cf_native", "cf_cdn", "unknown"].includes(explicit[0])) return explicit[0];
  if (network === "ws" && secure && !isIpLiteral(server)) return "unknown";
  return "direct";
}

function getWebSocketHost(proxy) {
  const headers = proxy?.["ws-opts"]?.headers || {};
  return String(headers.Host || headers.host || proxy?.servername || proxy?.sni || "").trim();
}

function isSplitWebSocketEndpoint(node, proxy) {
  const server = String(node?.host || proxy?.server || "").replace(/^\[|\]$/g, "");
  const hostHeader = getWebSocketHost(proxy).replace(/^\[|\]$/g, "");
  return String(proxy?.network || "tcp").toLowerCase() === "ws" && isIpLiteral(server) && hostHeader && !isIpLiteral(hostHeader) && hostHeader.toLowerCase() !== server.toLowerCase();
}

function applyNodeInclusionPolicy(node, result, settings, profiles, qualityMode) {
  const now = Date.now();
  const nodeClass = result.nodeClass || "unknown";
  const trustedSource = nodeClass === "cf_native" && (profiles || []).some((item) => item.trustedCf);
  const previousSuccessAt = Number(node.last_verified_success_at || 0);
  const previousFailures = Number(node.consecutive_verify_failures || 0);
  const previousSuccesses = Number(node.consecutive_verify_successes || 0);
  const failureLimit = clampNumber(settings.trusted_cf_failure_limit, 2, 10, 3);
  const successDays = clampNumber(settings.trusted_cf_success_days, 1, 30, 5);
  const successStillFresh = previousSuccessAt > 0 && now - previousSuccessAt <= successDays * DAY_MS;
  const countsAsFailure = ["invalid", "transport_failed", "verify_failed"].includes(result.level);

  let nextLastSuccessAt = previousSuccessAt;
  let nextFailures = previousFailures;
  let nextSuccesses = previousSuccesses;
  let included = qualityLevelIncluded(result.level, qualityMode);
  let includedReason = included ? result.level : "rejected";

  if (result.verified) {
    nextLastSuccessAt = now;
    nextFailures = 0;
    nextSuccesses = previousSuccesses + 1;
    included = true;
    includedReason = `verified_${nodeClass}`;
  } else if (countsAsFailure) {
    nextFailures = previousFailures + 1;
    nextSuccesses = 0;
  }

  if (!result.verified && trustedSource && successStillFresh) {
    if (countsAsFailure && nextFailures < failureLimit) {
      included = true;
      includedReason = nextFailures >= failureLimit - 1 ? "trusted_observe" : "trusted_retained";
    } else if (!countsAsFailure && ["cf_unknown", "transport"].includes(result.level)) {
      included = true;
      includedReason = result.level === "cf_unknown" ? "trusted_unknown_retained" : "trusted_transport_retained";
    }
  }

  return {
    nodeClass,
    trustedSource,
    included,
    includedReason,
    nextLastSuccessAt,
    nextFailures,
    nextSuccesses,
  };
}

async function probeNodeByClass(node, proxy, nodeClass, deadline) {
  return probeNodeByProtocol(node, proxy, deadline, nodeClass);
}

function validateNodeConfiguration(node) {
  const host = String(node.host || "").trim();
  const port = Number(node.port);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: "地址或端口无效" };
  if (isPrivateOrInvalidHost(host)) return { ok: false, error: "本地、私网或占位地址" };
  let proxy = null;
  try { proxy = node.clash_json ? JSON.parse(node.clash_json) : null; } catch { return { ok: false, error: "Clash 配置损坏" }; }
  if (!proxy || typeof proxy !== "object") return { ok: false, error: "缺少可解析的节点配置" };
  const type = String(proxy.type || node.protocol || "").toLowerCase();
  const network = String(proxy.network || "tcp").toLowerCase();
  if (!["tcp", "ws", "grpc", "http"].includes(network)) return { ok: false, error: `暂不支持的传输方式：${network}` };
  if (["vless", "vmess", "tuic"].includes(type) && !isUuid(String(proxy.uuid || ""))) return { ok: false, error: "UUID 格式无效" };
  if (type === "vless") {
    if (proxy.tls && proxy["reality-opts"]) {
      const reality = proxy["reality-opts"] || {};
      if (!reality["public-key"] || !reality["short-id"]) return { ok: false, error: "Reality 公钥或 Short ID 缺失" };
    }
    if (network === "ws" && !String(proxy["ws-opts"]?.path || "/").startsWith("/")) return { ok: false, error: "WebSocket 路径格式无效" };
  }
  if (type === "vmess" && !String(proxy.cipher || "auto")) return { ok: false, error: "VMess 加密方式缺失" };
  if (type === "trojan" && !String(proxy.password || "").trim()) return { ok: false, error: "Trojan 密码缺失" };
  if (type === "ss" && (!String(proxy.cipher || "").trim() || !String(proxy.password || "").trim())) return { ok: false, error: "Shadowsocks 加密方式或密码缺失" };
  if (type === "ssr" && (!String(proxy.cipher || "").trim() || !String(proxy.password || "").trim() || !String(proxy.protocol || "").trim())) return { ok: false, error: "SSR 参数不完整" };
  if (["hysteria2", "hy2"].includes(type) && !String(proxy.password || "").trim()) return { ok: false, error: "Hysteria2 密码缺失" };
  if (type === "tuic" && (!String(proxy.password || "").trim() || !isUuid(String(proxy.uuid || "")))) return { ok: false, error: "TUIC UUID 或密码无效" };
  const supported = ["vless", "vmess", "trojan", "ss", "ssr", "hysteria2", "hy2", "tuic", "socks5", "http"];
  if (!supported.includes(type)) return { ok: false, error: `暂不支持的协议：${type || "未知"}` };
  return { ok: true, proxy: { ...proxy, type, network } };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function isPrivateOrInvalidHost(host) {
  const value = String(host || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (["localhost", "example.com", "example.org", "0.0.0.0", "::", "::1"].includes(value)) return true;
  if (/^(your-|test\.|invalid\.|null$|undefined$)/i.test(value)) return true;
  const v4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const nums = v4.slice(1).map(Number);
    if (nums.some((n) => n > 255)) return true;
    if (nums[0] === 10 || nums[0] === 127 || nums[0] === 0 || nums[0] >= 224) return true;
    if (nums[0] === 169 && nums[1] === 254) return true;
    if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;
    if (nums[0] === 192 && nums[1] === 168) return true;
  }
  return false;
}

async function probeNodeByProtocol(node, proxy, deadline, nodeClass = "unknown") {
  const type = String(proxy.type || node.protocol || "").toLowerCase();
  if (type === "vless" && supportsVlessVerification(proxy)) return verifyVlessProxy(node, proxy, deadline, nodeClass);
  if (type === "trojan" && supportsTrojanVerification(proxy)) return verifyTrojanProxy(node, proxy, deadline, nodeClass);
  if (type === "ss" && supportsShadowsocksVerification(proxy)) return verifyShadowsocksProxy(node, proxy, deadline, nodeClass);
  if (type === "socks5") return verifySocks5Proxy(node, proxy, deadline);
  if (type === "http") return verifyHttpProxy(node, proxy, deadline);

  if (isSplitWebSocketEndpoint(node, proxy)) {
    // Worker 无法同时指定“连接 IP + 独立 TLS SNI + 独立 Host”。只验证域名入口，避免把优选 IP 配置直接判死。
    try {
      await verifyTransportOnly(node, proxy, deadline);
      return {
        level: "cf_unknown",
        transportOk: true,
        verified: false,
        verifyAttempted: false,
        probeMethod: "ws-domain-fallback",
        error: "优选 IP 与 Host/SNI 分离；域名 WSS 入口可达，但 Worker 无法完整复现客户端连接 IP",
      };
    } catch (error) {
      if (!error.probeStage) error.probeStage = "transport";
      throw error;
    }
  }

  await verifyTransportOnly(node, proxy, deadline);
  const typeLabel = type === "ss" ? `Shadowsocks ${String(proxy.cipher || "").trim() || "未知加密"}` : type.toUpperCase();
  return {
    level: "transport",
    transportOk: true,
    verified: false,
    verifyAttempted: false,
    probeMethod: "transport-only",
    error: `${typeLabel} 传输通过；当前 Worker 尚未完成该组合的真实代理验证`,
  };
}

function supportsVlessVerification(proxy) {
  if (proxy["reality-opts"] || String(proxy.flow || "").toLowerCase().includes("vision")) return false;
  return ["tcp", "ws"].includes(String(proxy.network || "tcp").toLowerCase());
}

function supportsTrojanVerification(proxy) {
  return ["tcp", "ws"].includes(String(proxy.network || "tcp").toLowerCase());
}

function supportsShadowsocksVerification(proxy) {
  const network = String(proxy.network || "tcp").toLowerCase();
  const cipher = String(proxy.cipher || "").toLowerCase();
  const plugin = String(proxy.plugin || proxy["plugin-opts"]?.mode || "").trim();
  return network === "tcp" && !plugin && SUPPORTED_SS_AEAD.has(cipher);
}

async function verifyTransportOnly(node, proxy, deadline) {
  const network = String(proxy.network || "tcp").toLowerCase();
  if (network === "ws") {
    const opened = await openNodeWebSocket(node, proxy, deadline);
    try { opened.ws.close(1000, "probe"); } catch {}
    return;
  }
  if (network === "grpc") {
    await probeGrpcTransport(node, proxy, deadline);
    return;
  }
  const socket = await openNodeSocket(node, proxy, deadline);
  await socket.close().catch(() => {});
}

async function verifyVlessProxy(node, proxy, deadline, nodeClass = "unknown") {
  const probe = createProbeRequest();
  const payload = buildVlessRequest(proxy.uuid, PROBE_TARGET_HOST, PROBE_TARGET_PORT, probe.request);
  const network = String(proxy.network || "tcp").toLowerCase();
  let response;
  let probeMethod = network === "ws" ? "vless-ws-echo" : "vless-tcp-echo";
  if (network === "ws") {
    const result = await exchangeWebSocket(node, proxy, payload, deadline);
    response = result.bytes;
    if (result.usedEarlyData) probeMethod += ":early-data";
    if (result.domainFallback) probeMethod += ":domain-fallback";
  } else {
    response = await exchangeSocket(node, proxy, payload, deadline);
  }
  const body = stripVlessResponseHeader(response);
  const echo = parseProbeHttpResponse(body, probe.nonce);
  if (!echo.ok) throw probeError(echo.error || "VLESS 代理出口没有返回有效随机回显", "verify");
  return {
    level: "verified",
    transportOk: true,
    verified: true,
    verifyAttempted: true,
    error: null,
    probeMethod,
    exitIp: echo.ip,
    exitLoc: echo.loc,
    nodeClass,
  };
}

async function verifyTrojanProxy(node, proxy, deadline, nodeClass = "unknown") {
  const probe = createProbeRequest();
  const passwordHash = sha224Hex(String(proxy.password || ""));
  const target = encodeSocksAddress(PROBE_TARGET_HOST, PROBE_TARGET_PORT);
  const payload = concatBytes(
    new TextEncoder().encode(passwordHash + "\r\n"),
    new Uint8Array([1]),
    target,
    new TextEncoder().encode("\r\n"),
    probe.request,
  );
  const network = String(proxy.network || "tcp").toLowerCase();
  let response;
  let probeMethod = network === "ws" ? "trojan-ws-echo" : "trojan-tcp-echo";
  if (network === "ws") {
    const result = await exchangeWebSocket(node, proxy, payload, deadline);
    response = result.bytes;
    if (result.usedEarlyData) probeMethod += ":early-data";
    if (result.domainFallback) probeMethod += ":domain-fallback";
  } else {
    response = await exchangeSocket(node, proxy, payload, deadline);
  }
  const echo = parseProbeHttpResponse(response, probe.nonce);
  if (!echo.ok) throw probeError(echo.error || "Trojan 认证或代理出口验证失败", "verify");
  return {
    level: "verified",
    transportOk: true,
    verified: true,
    verifyAttempted: true,
    error: null,
    probeMethod,
    exitIp: echo.ip,
    exitLoc: echo.loc,
    nodeClass,
  };
}

async function verifyShadowsocksProxy(node, proxy, deadline, nodeClass = "unknown") {
  const cipher = String(proxy.cipher || "").toLowerCase();
  const keyLength = SUPPORTED_SS_AEAD.get(cipher);
  if (!keyLength) throw probeError(`暂不支持的 Shadowsocks 加密：${cipher || "未知"}`, "verify");
  const probe = createProbeRequest();
  const socket = await openNodeSocket(node, { ...proxy, tls: false, sni: "", servername: "", network: "tcp" }, deadline);
  const reader = socket.readable.getReader();
  const buffered = createBufferedReader(reader);
  const writer = socket.writable.getWriter();
  try {
    const masterKey = evpBytesToKey(String(proxy.password || ""), keyLength);
    const clientSalt = crypto.getRandomValues(new Uint8Array(keyLength));
    const clientKey = await deriveShadowsocksSubkey(masterKey, clientSalt, keyLength);
    const nonce = new Uint8Array(12);
    const addressAndRequest = concatBytes(encodeSocksAddress(PROBE_TARGET_HOST, PROBE_TARGET_PORT), probe.request);
    const lengthBytes = new Uint8Array([(addressAndRequest.length >> 8) & 255, addressAndRequest.length & 255]);
    const encryptedLength = await aesGcmEncrypt(clientKey, nonce, lengthBytes);
    incrementLittleEndianNonce(nonce);
    const encryptedPayload = await aesGcmEncrypt(clientKey, nonce, addressAndRequest);
    await writeWithDeadline(writer, concatBytes(clientSalt, encryptedLength, encryptedPayload), deadline);

    const response = await readShadowsocksEchoResponse(buffered, masterKey, keyLength, deadline, probe.nonce);
    if (!response.ok) throw probeError(response.error || "Shadowsocks 代理出口验证失败", "verify");
    return {
      level: "verified",
      transportOk: true,
      verified: true,
      verifyAttempted: true,
      error: null,
      probeMethod: `ss-${cipher}-echo`,
      exitIp: response.ip,
      exitLoc: response.loc,
      nodeClass,
    };
  } catch (error) {
    if (!error.probeStage) error.probeStage = "verify";
    throw error;
  } finally {
    try { reader.releaseLock(); } catch {}
    try { writer.releaseLock(); } catch {}
    await socket.close().catch(() => {});
  }
}

async function verifySocks5Proxy(node, proxy, deadline) {
  const probe = createProbeRequest();
  const socket = await openNodeSocket(node, proxy, deadline);
  const reader = socket.readable.getReader();
  const buffered = createBufferedReader(reader);
  const writer = socket.writable.getWriter();
  try {
    const username = String(proxy.username || "");
    const password = String(proxy.password || "");
    await writeWithDeadline(writer, new Uint8Array(username || password ? [5, 2, 0, 2] : [5, 1, 0]), deadline);
    const hello = await buffered.readExact(2, deadline);
    if (hello[0] !== 5 || hello[1] === 255) throw probeError("SOCKS5 握手被拒绝", "verify");
    if (hello[1] === 2) {
      const u = new TextEncoder().encode(username); const p = new TextEncoder().encode(password);
      if (u.length > 255 || p.length > 255) throw probeError("SOCKS5 用户名或密码过长", "verify");
      await writeWithDeadline(writer, concatBytes(new Uint8Array([1, u.length]), u, new Uint8Array([p.length]), p), deadline);
      const auth = await buffered.readExact(2, deadline);
      if (auth[1] !== 0) throw probeError("SOCKS5 用户名或密码错误", "verify");
    }
    await writeWithDeadline(writer, concatBytes(new Uint8Array([5, 1, 0]), encodeSocksAddress(PROBE_TARGET_HOST, PROBE_TARGET_PORT)), deadline);
    const reply = await buffered.readExact(4, deadline);
    if (reply[0] !== 5 || reply[1] !== 0) throw probeError(`SOCKS5 连接目标失败（代码 ${reply[1]}）`, "verify");
    await drainSocksReplyAddress(buffered, reply[3], deadline);
    await writeWithDeadline(writer, probe.request, deadline);
    const data = await buffered.readUntilHttp(deadline, 32768);
    const echo = parseProbeHttpResponse(data, probe.nonce);
    if (!echo.ok) throw probeError(echo.error || "SOCKS5 代理出口验证失败", "verify");
    return {
      level: "verified", transportOk: true, verified: true, verifyAttempted: true, error: null,
      probeMethod: "socks5-echo", exitIp: echo.ip, exitLoc: echo.loc,
    };
  } catch (error) {
    if (!error.probeStage) error.probeStage = "verify";
    throw error;
  } finally {
    try { reader.releaseLock(); } catch {}
    try { writer.releaseLock(); } catch {}
    await socket.close().catch(() => {});
  }
}

async function verifyHttpProxy(node, proxy, deadline) {
  const probe = createProbeRequest();
  const socket = await openNodeSocket(node, proxy, deadline);
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  try {
    const username = String(proxy.username || "");
    const password = String(proxy.password || "");
    const auth = username || password ? `Proxy-Authorization: Basic ${encodeBase64Utf8(`${username}:${password}`)}\r\n` : "";
    const request = new TextEncoder().encode(`GET http://${PROBE_TARGET_HOST}${probe.path} HTTP/1.1\r\nHost: ${PROBE_TARGET_HOST}\r\n${auth}User-Agent: ${probe.userAgent}\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n`);
    await writeWithDeadline(writer, request, deadline);
    const data = await readUntilHttp(reader, deadline, 32768);
    const text = new TextDecoder().decode(data);
    if (/^HTTP\/1\.[01] 407/m.test(text)) throw probeError("HTTP 代理认证失败", "verify");
    const echo = parseProbeHttpResponse(data, probe.nonce);
    if (!echo.ok) throw probeError(echo.error || "HTTP 代理出口验证失败", "verify");
    return {
      level: "verified", transportOk: true, verified: true, verifyAttempted: true, error: null,
      probeMethod: "http-proxy-echo", exitIp: echo.ip, exitLoc: echo.loc,
    };
  } catch (error) {
    if (!error.probeStage) error.probeStage = "verify";
    throw error;
  } finally {
    try { reader.releaseLock(); } catch {}
    try { writer.releaseLock(); } catch {}
    await socket.close().catch(() => {});
  }
}

async function exchangeSocket(node, proxy, payload, deadline) {
  const socket = await openNodeSocket(node, proxy, deadline);
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  try {
    await writeWithDeadline(writer, payload, deadline);
    return await readUntilHttp(reader, deadline);
  } catch (error) {
    if (!error.probeStage) error.probeStage = "verify";
    throw error;
  } finally {
    try { reader.releaseLock(); } catch {}
    try { writer.releaseLock(); } catch {}
    await socket.close().catch(() => {});
  }
}

async function openNodeSocket(node, proxy, deadline) {
  const network = String(proxy.network || "tcp").toLowerCase();
  if (network !== "tcp" && network !== "http") throw probeError(`不能用 TCP 检查 ${network} 传输`, "transport");
  const reality = Boolean(proxy["reality-opts"]);
  const secure = Boolean(proxy.tls || proxy.sni || proxy.servername || node.tls) && !reality;
  const dial = resolveSocketDialPlan(node, proxy, secure);
  const socket = connect({ hostname: dial.hostname, port: Number(node.port) }, { secureTransport: secure ? "on" : "off" });
  try {
    await withDeadline(socket.opened, deadline, secure ? "TLS 握手超时" : "TCP 连接超时", "transport");
    return socket;
  } catch (error) {
    await socket.close().catch(() => {});
    throw error;
  }
}

function resolveSocketDialPlan(node, proxy, secure) {
  const host = String(node.host || proxy.server || "").trim();
  const sni = String(proxy.servername || proxy.sni || "").trim();
  if (secure && isIpLiteral(host) && sni && !isIpLiteral(sni)) {
    return { hostname: sni, domainFallback: true };
  }
  return { hostname: host, domainFallback: false };
}

function transportHostname(node, proxy) {
  return resolveSocketDialPlan(node, proxy, Boolean(proxy.tls || proxy.sni || proxy.servername || node.tls)).hostname;
}

async function openNodeWebSocket(node, proxy, deadline, earlyPayload = null) {
  const opts = proxy["ws-opts"] || {};
  const configuredHeaders = opts.headers && typeof opts.headers === "object" ? opts.headers : {};
  const hostHeader = getWebSocketHost(proxy);
  const rawServer = String(node.host || proxy.server || "").trim();
  const domainFallback = isIpLiteral(rawServer) && hostHeader && !isIpLiteral(hostHeader) && hostHeader.toLowerCase() !== rawServer.toLowerCase();
  const targetHost = domainFallback ? hostHeader : rawServer;
  const secure = Boolean(proxy.tls || node.tls || Number(node.port) === 443);
  let path = String(opts.path || "/");
  if (!path.startsWith("/")) path = "/" + path;
  const defaultPort = (secure && Number(node.port) === 443) || (!secure && Number(node.port) === 80);
  const displayHost = targetHost.includes(":") && !targetHost.startsWith("[") ? `[${targetHost}]` : targetHost;
  const url = `${secure ? "https" : "http"}://${displayHost}${defaultPort ? "" : `:${Number(node.port)}`}${path}`;
  const headers = new Headers({ Upgrade: "websocket", "User-Agent": `CactusProbe/${APP_VERSION}` });
  for (const [key, value] of Object.entries(configuredHeaders)) {
    if (/^(host|connection|upgrade|sec-websocket-key|sec-websocket-version)$/i.test(key)) continue;
    try { headers.set(key, String(value)); } catch {}
  }
  let early = prepareWebSocketEarlyData(proxy, path, earlyPayload);
  if (early) {
    try { headers.set(early.headerName, early.encoded); }
    catch { early = null; }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remainingMs(deadline));
  let response;
  try {
    response = await fetch(url, { headers, signal: controller.signal, redirect: "manual" });
  } catch (error) {
    throw probeError(error?.name === "AbortError" ? "WebSocket 握手超时" : friendlyError(error), "transport");
  } finally {
    clearTimeout(timer);
  }
  const ws = response.webSocket;
  if (!ws) {
    if (response.body) await response.body.cancel().catch(() => {});
    throw probeError(`WebSocket 握手失败（HTTP ${response.status}）`, "transport");
  }
  try { ws.accept({ allowHalfOpen: true }); } catch { ws.accept(); }
  return { ws, usedEarlyData: Boolean(early), domainFallback, endpoint: url };
}

function prepareWebSocketEarlyData(proxy, path, payload) {
  if (!payload) return null;
  const bytes = toUint8(payload);
  const opts = proxy["ws-opts"] || {};
  let limit = Number(opts["max-early-data"] || proxy["max-early-data"] || 0);
  try {
    const fake = new URL(path, "https://probe.invalid");
    limit = Number(fake.searchParams.get("ed") || limit || 0);
  } catch {}
  if (!Number.isFinite(limit) || limit <= 0 || bytes.length > limit) return null;
  const headerName = String(opts["early-data-header-name"] || proxy["early-data-header-name"] || "Sec-WebSocket-Protocol").trim();
  if (!headerName || /^(host|connection|upgrade|sec-websocket-key|sec-websocket-version)$/i.test(headerName)) return null;
  return { headerName, encoded: base64UrlEncodeBytes(bytes) };
}

async function exchangeWebSocket(node, proxy, payload, deadline) {
  const opened = await openNodeWebSocket(node, proxy, deadline, payload);
  const ws = opened.ws;
  try {
    const responsePromise = withDeadline(new Promise((resolve, reject) => {
      const chunks = [];
      ws.addEventListener("message", (event) => {
        const value = event.data;
        if (value instanceof ArrayBuffer) chunks.push(new Uint8Array(value));
        else if (ArrayBuffer.isView(value)) chunks.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
        else chunks.push(new TextEncoder().encode(String(value)));
        const joined = concatBytes(...chunks);
        if (looksLikeCompleteHttp(joined) || looksLikeCompleteHttp(stripVlessResponseHeader(joined)) || joined.length >= 32768) resolve(joined);
      });
      ws.addEventListener("close", () => {
        const joined = concatBytes(...chunks);
        if (joined.length) resolve(joined); else reject(probeError("WebSocket 在返回数据前关闭", "verify"));
      }, { once: true });
      ws.addEventListener("error", () => reject(probeError("WebSocket 数据交换失败", "verify")), { once: true });
    }), deadline, "代理验证超时", "verify");
    if (!opened.usedEarlyData) ws.send(payload);
    const bytes = await responsePromise;
    return { bytes, usedEarlyData: opened.usedEarlyData, domainFallback: opened.domainFallback };
  } finally {
    try { ws.close(1000, "done"); } catch {}
  }
}

async function probeGrpcTransport(node, proxy, deadline) {
  const opts = proxy["grpc-opts"] || {};
  const service = String(opts["grpc-service-name"] || "").replace(/^\/+|\/+$/g, "");
  if (!service) throw probeError("gRPC service name 缺失", "transport");
  const secure = Boolean(proxy.tls || node.tls || Number(node.port) === 443);
  const host = transportHostname(node, proxy);
  const defaultPort = (secure && Number(node.port) === 443) || (!secure && Number(node.port) === 80);
  const displayHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remainingMs(deadline));
  try {
    const response = await fetch(`${secure ? "https" : "http"}://${displayHost}${defaultPort ? "" : `:${Number(node.port)}`}/${service}/Tun`, {
      method: "POST",
      headers: { "Content-Type": "application/grpc", "TE": "trailers", "User-Agent": `CactusProbe/${APP_VERSION}` },
      body: new Uint8Array([0, 0, 0, 0, 0]),
      signal: controller.signal,
      redirect: "manual",
    });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const grpcStatus = response.headers.get("grpc-status");
    if (response.body) await response.body.cancel().catch(() => {});
    if (!contentType.includes("application/grpc") && grpcStatus == null) throw probeError(`gRPC 路径未返回 gRPC 响应（HTTP ${response.status}）`, "transport");
  } finally { clearTimeout(timer); }
}

function buildVlessRequest(uuid, targetHost, targetPort, payload) {
  const uuidBytes = uuidToBytes(uuid);
  const port = Number(targetPort);
  const portBytes = new Uint8Array([(port >> 8) & 255, port & 255]);
  return concatBytes(new Uint8Array([0]), uuidBytes, new Uint8Array([0, 1]), portBytes, encodeVlessAddress(targetHost), payload);
}

function encodeVlessAddress(host) {
  const hostText = String(host || "");
  const v4 = hostText.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return new Uint8Array([1, ...v4.slice(1).map(Number)]);
  const domain = new TextEncoder().encode(hostText);
  if (domain.length > 255) throw probeError("目标域名过长", "verify");
  return concatBytes(new Uint8Array([2, domain.length]), domain);
}

function stripVlessResponseHeader(bytes) {
  const data = toUint8(bytes);
  if (data.length >= 2 && data[0] === 0) {
    const addonLength = data[1];
    if (data.length >= 2 + addonLength) return data.slice(2 + addonLength);
  }
  return data;
}

function encodeSocksAddress(host, port) {
  const hostText = String(host || "");
  const portBytes = new Uint8Array([(Number(port) >> 8) & 255, Number(port) & 255]);
  const v4 = hostText.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return concatBytes(new Uint8Array([1, ...v4.slice(1).map(Number)]), portBytes);
  const domain = new TextEncoder().encode(hostText);
  if (domain.length > 255) throw probeError("目标域名过长", "verify");
  return concatBytes(new Uint8Array([3, domain.length]), domain, portBytes);
}

function createProbeRequest() {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(12));
  const nonce = [...nonceBytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  const userAgent = `CactusProbe/${APP_VERSION}/${nonce}`;
  const path = `${PROBE_TARGET_PATH}-${nonce}?nonce=${nonce}`;
  const request = new TextEncoder().encode(
    `GET ${path} HTTP/1.1\r\n` +
    `Host: ${PROBE_TARGET_HOST}\r\n` +
    `User-Agent: ${userAgent}\r\n` +
    `Accept: application/json\r\n` +
    `Accept-Encoding: identity\r\n` +
    `Cache-Control: no-store\r\n` +
    `Pragma: no-cache\r\n` +
    `Connection: close\r\n\r\n`
  );
  return { nonce, userAgent, path, request };
}

function parseHttpEnvelope(value) {
  const bytes = toUint8(value);
  const text = new TextDecoder().decode(bytes);
  const headerEnd = text.indexOf("\r\n\r\n");
  if (headerEnd < 0) return { complete: false, error: "HTTP 响应头不完整", status: 0, headers: {}, body: "" };
  const head = text.slice(0, headerEnd);
  const statusMatch = head.match(/^HTTP\/1\.[01]\s+(\d{3})\b/i);
  if (!statusMatch) return { complete: false, error: "没有收到有效 HTTP 响应", status: 0, headers: {}, body: "" };
  const headers = {};
  for (const line of head.split("\r\n").slice(1)) {
    const pos = line.indexOf(":");
    if (pos > 0) headers[line.slice(0, pos).trim().toLowerCase()] = line.slice(pos + 1).trim();
  }
  let body = text.slice(headerEnd + 4);
  const transfer = String(headers["transfer-encoding"] || "").toLowerCase();
  if (transfer.includes("chunked")) {
    const decoded = decodeChunkedHttpBody(body);
    if (!decoded.complete) return { complete: false, error: decoded.error || "分块响应尚未接收完整", status: Number(statusMatch[1]), headers, body: decoded.body || "" };
    body = decoded.body;
  } else if (headers["content-length"] !== undefined) {
    const expected = Number(headers["content-length"]);
    const actual = new TextEncoder().encode(body).length;
    if (Number.isFinite(expected) && actual < expected) return { complete: false, error: "HTTP 响应正文尚未接收完整", status: Number(statusMatch[1]), headers, body };
  }
  return { complete: true, status: Number(statusMatch[1]), headers, body };
}

function decodeChunkedHttpBody(raw) {
  let offset = 0;
  let output = "";
  while (offset < raw.length) {
    const lineEnd = raw.indexOf("\r\n", offset);
    if (lineEnd < 0) return { complete: false, body: output };
    const sizeText = raw.slice(offset, lineEnd).split(";", 1)[0].trim();
    if (!/^[0-9a-f]+$/i.test(sizeText)) return { complete: false, body: output, error: "HTTP 分块长度格式错误" };
    const size = Number.parseInt(sizeText, 16);
    offset = lineEnd + 2;
    if (size === 0) {
      const trailerEnd = raw.indexOf("\r\n\r\n", offset);
      if (trailerEnd >= 0 || raw.slice(offset).startsWith("\r\n") || offset === raw.length) return { complete: true, body: output };
      return { complete: false, body: output };
    }
    if (offset + size + 2 > raw.length) return { complete: false, body: output };
    output += raw.slice(offset, offset + size);
    offset += size;
    if (raw.slice(offset, offset + 2) !== "\r\n") return { complete: false, body: output, error: "HTTP 分块结尾格式错误" };
    offset += 2;
  }
  return { complete: false, body: output };
}

function readHeaderValue(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const wanted = String(name || "").toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== wanted) continue;
    return Array.isArray(value) ? value.join(" ") : String(value ?? "");
  }
  return "";
}

function parseProbeHttpResponse(value, nonce = "") {
  const envelope = parseHttpEnvelope(value);
  if (!envelope.complete) return { ok: false, error: envelope.error || "没有收到完整 HTTP 响应" };
  if (envelope.status !== 200) return { ok: false, error: `验证页面返回 HTTP ${envelope.status}` };
  let payload;
  try {
    payload = JSON.parse(envelope.body);
  } catch {
    return { ok: false, error: "随机回显接口没有返回有效 JSON" };
  }
  const origin = String(payload?.origin || "").trim();
  const url = String(payload?.url || "");
  const userAgent = readHeaderValue(payload?.headers, "user-agent");
  if (!origin) return { ok: false, error: "随机回显响应缺少代理出口 IP" };
  if (nonce && (!url.includes(`/anything/cactus-${nonce}`) || !url.includes(`nonce=${nonce}`))) {
    return { ok: false, error: "随机回显 URL 令牌不匹配，可能不是本次代理请求" };
  }
  if (nonce && !userAgent.includes(nonce)) {
    return { ok: false, error: "随机回显 User-Agent 令牌不匹配，可能发生了缓存或直连兜底" };
  }
  const ip = origin.split(",", 1)[0].trim();
  return { ok: true, ip, loc: "", colo: "", http: "", tls: "", warp: "", url, userAgent };
}

function looksLikeCompleteHttp(value) {
  const envelope = parseHttpEnvelope(value);
  if (!envelope.complete) return false;
  if (envelope.status < 200 || envelope.status >= 600) return true;
  try {
    const payload = JSON.parse(envelope.body);
    return Boolean(payload && typeof payload === "object" && payload.origin && payload.url);
  } catch {
    return true;
  }
}

async function readUntilHttp(reader, deadline, maxBytes = 32768) {
  const chunks = [];
  let total = 0;
  while (remainingMs(deadline) > 0 && total < maxBytes) {
    const result = await withDeadline(reader.read(), deadline, "读取代理响应超时", "verify");
    if (result.done) break;
    const chunk = toUint8(result.value);
    chunks.push(chunk); total += chunk.length;
    const joined = concatBytes(...chunks);
    if (looksLikeCompleteHttp(stripVlessResponseHeader(joined))) return joined;
  }
  return concatBytes(...chunks);
}

function base64UrlEncodeBytes(value) {
  const bytes = toUint8(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function readAtLeast(reader, count, deadline) {
  const chunks = []; let total = 0;
  while (total < count) {
    const result = await withDeadline(reader.read(), deadline, "读取握手响应超时", "verify");
    if (result.done) throw probeError("连接提前关闭", "verify");
    const chunk = toUint8(result.value); chunks.push(chunk); total += chunk.length;
  }
  return concatBytes(...chunks);
}

async function drainSocksReplyAddress(buffered, atyp, deadline) {
  if (atyp === 1) { await buffered.readExact(6, deadline); return; }
  if (atyp === 4) { await buffered.readExact(18, deadline); return; }
  if (atyp === 3) {
    const len = await buffered.readExact(1, deadline);
    await buffered.readExact(Number(len[0]) + 2, deadline);
    return;
  }
  throw probeError("SOCKS5 返回了未知地址类型", "verify");
}

function createBufferedReader(reader) {
  let buffer = new Uint8Array();
  async function fill(deadline) {
    const result = await withDeadline(reader.read(), deadline, "读取代理响应超时", "verify");
    if (result.done) throw probeError("连接提前关闭", "verify");
    buffer = concatBytes(buffer, result.value);
  }
  return {
    async readExact(count, deadline) {
      while (buffer.length < count) await fill(deadline);
      const output = buffer.slice(0, count);
      buffer = buffer.slice(count);
      return output;
    },
    async readUntilHttp(deadline, maxBytes = 16384) {
      while (remainingMs(deadline) > 0 && buffer.length < maxBytes) {
        if (looksLikeCompleteHttp(buffer)) return buffer;
        try { await fill(deadline); } catch (error) {
          if (buffer.length) return buffer;
          throw error;
        }
      }
      return buffer;
    },
  };
}

async function readShadowsocksEchoResponse(buffered, masterKey, keyLength, deadline, nonce) {
  const serverSalt = await buffered.readExact(keyLength, deadline);
  const serverKey = await deriveShadowsocksSubkey(masterKey, serverSalt, keyLength);
  const counter = new Uint8Array(12);
  const chunks = [];
  let total = 0;
  while (remainingMs(deadline) > 0 && total < 32768) {
    const encryptedLength = await buffered.readExact(2 + 16, deadline);
    let lengthPlain;
    try {
      lengthPlain = await aesGcmDecrypt(serverKey, counter, encryptedLength);
    } catch {
      throw probeError("Shadowsocks 响应长度解密失败，密码或加密方式可能错误", "verify");
    }
    incrementLittleEndianNonce(counter);
    if (lengthPlain.length !== 2) throw probeError("Shadowsocks 响应长度格式错误", "verify");
    const payloadLength = (lengthPlain[0] << 8) | lengthPlain[1];
    if (payloadLength < 1 || payloadLength > 0x3fff) throw probeError(`Shadowsocks 响应分片长度异常：${payloadLength}`, "verify");
    const encryptedPayload = await buffered.readExact(payloadLength + 16, deadline);
    let payload;
    try {
      payload = await aesGcmDecrypt(serverKey, counter, encryptedPayload);
    } catch {
      throw probeError("Shadowsocks 响应内容解密失败", "verify");
    }
    incrementLittleEndianNonce(counter);
    chunks.push(payload);
    total += payload.length;
    const joined = concatBytes(...chunks);
    const parsed = parseProbeHttpResponse(joined, nonce);
    if (parsed.ok) return parsed;
    if (looksLikeCompleteHttp(joined)) return parsed;
  }
  return parseProbeHttpResponse(concatBytes(...chunks), nonce);
}

function evpBytesToKey(password, keyLength) {
  const passwordBytes = new TextEncoder().encode(String(password || ""));
  const output = new Uint8Array(keyLength);
  let generated = 0;
  let previous = new Uint8Array();
  while (generated < keyLength) {
    previous = md5Bytes(concatBytes(previous, passwordBytes));
    const take = Math.min(previous.length, keyLength - generated);
    output.set(previous.subarray(0, take), generated);
    generated += take;
  }
  return output;
}

async function deriveShadowsocksSubkey(masterKey, salt, keyLength) {
  const material = await crypto.subtle.importKey("raw", toUint8(masterKey), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "HKDF",
    hash: "SHA-1",
    salt: toUint8(salt),
    info: new TextEncoder().encode("ss-subkey"),
  }, material, keyLength * 8);
  return new Uint8Array(bits);
}

async function aesGcmEncrypt(rawKey, nonce, plaintext) {
  const key = await crypto.subtle.importKey("raw", toUint8(rawKey), { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toUint8(nonce), tagLength: 128 }, key, toUint8(plaintext));
  return new Uint8Array(encrypted);
}

async function aesGcmDecrypt(rawKey, nonce, ciphertext) {
  const key = await crypto.subtle.importKey("raw", toUint8(rawKey), { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toUint8(nonce), tagLength: 128 }, key, toUint8(ciphertext));
  return new Uint8Array(decrypted);
}

function incrementLittleEndianNonce(nonce) {
  for (let index = 0; index < nonce.length; index++) {
    nonce[index] = (nonce[index] + 1) & 255;
    if (nonce[index] !== 0) break;
  }
}

function md5Bytes(input) {
  const bytes = toUint8(input);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  let bitLength = BigInt(bytes.length) * 8n;
  for (let index = 0; index < 8; index++) {
    data[paddedLength - 8 + index] = Number(bitLength & 255n);
    bitLength >>= 8n;
  }
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const shifts = [
    7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
    5,9,14,20, 5,9,14,20, 5,9,14,20, 5,9,14,20,
    4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
    6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21,
  ];
  const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0);
  const rotateLeft = (value, count) => ((value << count) | (value >>> (32 - count))) >>> 0;
  const view = new DataView(data.buffer);
  for (let offset = 0; offset < data.length; offset += 64) {
    const words = new Uint32Array(16);
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let index = 0; index < 64; index++) {
      let f, g;
      if (index < 16) { f = (b & c) | ((~b) & d); g = index; }
      else if (index < 32) { f = (d & b) | ((~d) & c); g = (5 * index + 1) % 16; }
      else if (index < 48) { f = b ^ c ^ d; g = (3 * index + 5) % 16; }
      else { f = c ^ (b | (~d)); g = (7 * index) % 16; }
      const nextD = d;
      d = c;
      c = b;
      const sum = (a + f + constants[index] + words[g]) >>> 0;
      b = (b + rotateLeft(sum, shifts[index])) >>> 0;
      a = nextD;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}

async function writeWithDeadline(writer, bytes, deadline) {
  await withDeadline(writer.write(toUint8(bytes)), deadline, "写入代理请求超时", "verify");
}

function remainingMs(deadline) { return Math.max(1, Number(deadline) - Date.now()); }

async function withDeadline(promise, deadline, message, stage = "transport") {
  const ms = remainingMs(deadline);
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(probeError(message, stage)), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}

function probeError(message, stage = "transport") {
  const error = new Error(message);
  error.probeStage = stage;
  return error;
}

function isCloudflareSocketRestriction(message) {
  return /cloudflare ip|proxy request failed|cannot connect to cloudflare|tcp loop detected|disallowed address|destination address is not allowed/i.test(String(message || ""));
}

function isIpLiteral(host) {
  const value = String(host || "").replace(/^\[|\]$/g, "");
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || value.includes(":");
}

function uuidToBytes(uuid) {
  const hex = String(uuid || "").replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw probeError("UUID 格式无效", "verify");
  return new Uint8Array(hex.match(/../g).map((pair) => parseInt(pair, 16)));
}

function toUint8(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return new TextEncoder().encode(String(value || ""));
}

function concatBytes(...parts) {
  const arrays = parts.filter(Boolean).map(toUint8);
  const total = arrays.reduce((sum, item) => sum + item.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const item of arrays) { output.set(item, offset); offset += item.length; }
  return output;
}

// Minimal SHA-224 implementation for Trojan password authentication.
function sha224Hex(message) {
  const bytes = new TextEncoder().encode(String(message));
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength); data.set(bytes); data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  const h = [0xc1059ed8,0x367cd507,0x3070dd17,0xf70e5939,0xffc00b31,0x68581511,0x64f98fa7,0xbefa4fa4];
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  const w=new Uint32Array(64);
  for(let off=0;off<data.length;off+=64){
    for(let i=0;i<16;i++)w[i]=view.getUint32(off+i*4,false);
    for(let i=16;i<64;i++){const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);const s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25);const ch=(e&f)^((~e)&g);const t1=(hh+s1+ch+k[i]+w[i])>>>0;const s0=rotr(a,2)^rotr(a,13)^rotr(a,22);const maj=(a&b)^(a&c)^(b&c);const t2=(s0+maj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+hh)>>>0;
  }
  return h.slice(0,7).map(x=>x.toString(16).padStart(8,"0")).join("");
}

async function refreshSourceRunStats(env, runId, settings = DEFAULT_SETTINGS) {
  const rows = await env.DB.prepare(
    `SELECT rns.source_id,
      COUNT(*) AS unique_count,
      SUM(CASE WHEN rn.config_ok=1 THEN 1 ELSE 0 END) AS config_pass,
      SUM(CASE WHEN rn.transport_status='passed' THEN 1 ELSE 0 END) AS transport_pass,
      SUM(CASE WHEN rn.result_level='verified' THEN 1 ELSE 0 END) AS verified_count,
      SUM(CASE WHEN rns.whitelist_selected=1 THEN 1 ELSE 0 END) AS whitelist_selected_count,
      SUM(CASE WHEN rns.whitelist_skipped=1 THEN 1 ELSE 0 END) AS whitelist_skipped_count,
      SUM(CASE WHEN rn.status='alive' AND (
        (COALESCE(s.random_whitelist,0)=1 AND rns.whitelist_selected=1)
        OR (COALESCE(s.random_whitelist,0)=0 AND COALESCE(rn.included_reason,'')<>'whitelist_random')
      ) THEN 1 ELSE 0 END) AS included_count,
      SUM(CASE WHEN rn.result_level='cf_unknown' THEN 1 ELSE 0 END) AS cf_unknown_count,
      SUM(CASE WHEN rn.status='dead' THEN 1 ELSE 0 END) AS failed_count,
      SUM(CASE WHEN rn.included_reason LIKE 'trusted_%' THEN 1 ELSE 0 END) AS trusted_retained_count,
      SUM(CASE WHEN rn.node_class='direct' THEN 1 ELSE 0 END) AS direct_count,
      SUM(CASE WHEN rn.node_class='cf_native' THEN 1 ELSE 0 END) AS cf_native_count,
      SUM(CASE WHEN rn.node_class='cf_cdn' THEN 1 ELSE 0 END) AS cf_cdn_count,
      SUM(CASE WHEN rn.node_class='unknown' OR rn.node_class IS NULL THEN 1 ELSE 0 END) AS unknown_type_count,
      SUM(CASE WHEN rn.status='alive' AND (
        (COALESCE(s.random_whitelist,0)=1 AND rns.whitelist_selected=1)
        OR (COALESCE(s.random_whitelist,0)=0 AND COALESCE(rn.included_reason,'')<>'whitelist_random')
      ) AND (SELECT COUNT(*) FROM run_node_sources x WHERE x.run_id=rns.run_id AND x.node_id=rns.node_id)=1 THEN 1 ELSE 0 END) AS exclusive_count
     FROM run_node_sources rns
     JOIN run_nodes rn ON rn.run_id=rns.run_id AND rn.node_id=rns.node_id
     JOIN sources s ON s.id=rns.source_id
     WHERE rns.run_id=? GROUP BY rns.source_id`
  ).bind(runId).all();
  if (rows.results?.length) {
    await env.DB.batch(rows.results.map((row) => env.DB.prepare(
      `UPDATE source_run_stats SET unique_count=?,config_pass=?,transport_pass=?,verified_count=?,included_count=?,exclusive_count=?,cf_unknown_count=?,failed_count=?,
       trusted_retained_count=?,whitelist_selected_count=?,whitelist_skipped_count=?,direct_count=?,cf_native_count=?,cf_cdn_count=?,unknown_type_count=?
       WHERE run_id=? AND source_id=?`
    ).bind(
      Number(row.unique_count||0),Number(row.config_pass||0),Number(row.transport_pass||0),Number(row.verified_count||0),
      Number(row.included_count||0),Number(row.exclusive_count||0),Number(row.cf_unknown_count||0),Number(row.failed_count||0),
      Number(row.trusted_retained_count||0),Number(row.whitelist_selected_count||0),Number(row.whitelist_skipped_count||0),
      Number(row.direct_count||0),Number(row.cf_native_count||0),Number(row.cf_cdn_count||0),Number(row.unknown_type_count||0),
      runId,Number(row.source_id)
    )));
  }
  if (String(settings.source_auto_disable || "0") === "1") await autoDisableLowQualitySources(env, settings);
}

async function autoDisableLowQualitySources(env, settings) {
  const runs = clampNumber(settings.source_low_quality_runs, 3, 20, 5);
  const maxVerified = clampNumber(settings.source_low_quality_verified_max, 0, 1000, 1);
  const sources = await env.DB.prepare(`SELECT id,trusted_cf,random_whitelist FROM sources WHERE enabled=1`).all();
  for (const source of sources.results || []) {
    if (Number(source.trusted_cf || 0) === 1 || Number(source.random_whitelist || 0) === 1) continue;
    const recent = await env.DB.prepare(
      `SELECT verified_count,trusted_retained_count,exclusive_count FROM source_run_stats WHERE source_id=? ORDER BY run_id DESC LIMIT ?`
    ).bind(source.id, runs).all();
    const stats = recent.results || [];
    if (stats.length < runs) continue;
    if (stats.every((row) => Number(row.verified_count||0) + Number(row.trusted_retained_count||0) <= maxVerified && Number(row.exclusive_count||0) === 0)) {
      await env.DB.prepare(`UPDATE sources SET enabled=0,last_error=? WHERE id=?`).bind(`连续 ${runs} 次有效贡献过低，已自动停用`,source.id).run();
    }
  }
}
async function publishRun(env, runId, origin = "", force = false) {
  if (!env.SUB_TOKEN) throw new Error("请先在 Worker 机密中配置 SUB_TOKEN，再发布日报");
  const run = await env.DB.prepare(`SELECT * FROM runs WHERE id=?`).bind(runId).first();
  if (!run) throw new Error("任务不存在");
  if (!["completed", "published"].includes(run.status) && !force) {
    throw new Error("任务尚未完成，不能生成报告");
  }
  if (Number(run.tested) < Number(run.total_unique)) {
    throw new Error("仍有节点尚未测活");
  }

  const settings = await getSettings(env);
  const aliveNodes = await getAliveNodesForRun(env, runId);
  const sourceCountRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM sources WHERE enabled=1`).first();
  const sourceCount = Number(sourceCountRow?.count || 0);
  const clashContent = buildClashSubscription(aliveNodes, settings);
  const v2rayContent = buildV2raySubscription(aliveNodes, settings);
  await cacheRunSubscriptions(env, runId, clashContent, v2rayContent, true);

  const stats = {
    source_count: sourceCount,
    fetched_count: Number(run.total_fetched || 0),
    unique_count: Number(run.total_unique || 0),
    alive_count: Number(run.alive || 0),
    dead_count: Number(run.dead || 0),
    config_count: Number(run.config_pass || 0),
    transport_count: Number(run.transport_pass || 0),
    verified_count: Number(run.verified || 0),
    transport_only_count: Number(run.transport_only || 0),
    unknown_count: Number(run.cf_unknown || 0),
    invalid_count: Number(run.invalid || 0),
    verify_failed_count: Number(run.verify_failed || 0),
    trusted_retained_count: Number(run.trusted_retained || 0),
    whitelist_selected_count: Number(run.whitelist_selected || 0),
    whitelist_skipped_count: Number(run.whitelist_skipped || 0),
    completed_at: run.completed_at,
    published_at: Date.now(),
  };
  const templateVars = reportTemplateVars(run.date_key, stats);
  const title = renderTemplateString(settings.report_title_template, templateVars)
    || `${humanDateFromDateKey(run.date_key)} 免费节点更新`;
  const summaryHtml = buildReportSummaryHtml(stats, settings, run.date_key);
  const excerpt = renderTemplateString(settings.report_excerpt_template, templateVars)
    || excerptFromHtml(summaryHtml, 180);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO reports(run_id, date_key, title, summary_html, stats_json, published, created_at, published_at)
     VALUES(?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(run_id) DO UPDATE SET
       title=excluded.title,
       summary_html=excluded.summary_html,
       stats_json=excluded.stats_json,
       published=1,
       published_at=excluded.published_at`
  ).bind(runId, run.date_key, title, summaryHtml, JSON.stringify(stats), now, now).run();

  await env.DB.prepare(
    `UPDATE runs SET status='published', published_at=?, error=NULL WHERE id=?`
  ).bind(now, runId).run();

  const report = await env.DB.prepare(`SELECT * FROM reports WHERE run_id=?`).bind(runId).first();
  if (report) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO report_meta(report_id, excerpt, pinned, updated_at) VALUES(?, ?, 0, ?)`
    ).bind(report.id, excerpt.slice(0, 300), now).run();
  }
  if (origin) await env.CACHE.put("latest:origin", origin);
  return { ...report, stats };
}

async function getAliveNodesForRun(env, runId) {
  const rows = await env.DB.prepare(
    `SELECT n.*, COALESCE(NULLIF(s.public_alias,''), s.name, 'Source') AS source_alias
     FROM run_nodes rn
     JOIN nodes n ON n.id=rn.node_id
     LEFT JOIN sources s ON s.id=n.source_id
     WHERE rn.run_id=? AND rn.status='alive'
     ORDER BY n.protocol, n.id`
  ).bind(runId).all();
  return rows.results || [];
}

async function refreshLatestPublishedCache(env) {
  const latest = await env.DB.prepare(
    `SELECT r.run_id FROM reports r WHERE r.published=1 ORDER BY r.published_at DESC LIMIT 1`
  ).first();
  if (!latest) {
    await Promise.all([
      deleteKvContent(env, "latest:clash"),
      deleteKvContent(env, "latest:v2ray"),
      env.CACHE.delete("latest:run"),
    ]);
    return;
  }
  const settings = await getSettings(env);
  const nodes = await getAliveNodesForRun(env, latest.run_id);
  await cacheRunSubscriptions(
    env,
    Number(latest.run_id),
    buildClashSubscription(nodes, settings),
    buildV2raySubscription(nodes, settings),
    true,
  );
}

function reportTemplateVars(dateKey, stats) {
  return {
    date: humanDateFromDateKey(dateKey),
    date_key: String(dateKey || ""),
    sources: String(Number(stats.source_count || 0)),
    fetched: String(Number(stats.fetched_count || 0)),
    unique: String(Number(stats.unique_count || 0)),
    alive: String(Number(stats.alive_count || 0)),
    dead: String(Number(stats.dead_count || 0)),
    config: String(Number(stats.config_count || 0)),
    transport: String(Number(stats.transport_count || 0)),
    verified: String(Number(stats.verified_count || 0)),
    trusted: String(Number(stats.trusted_retained_count || 0)),
    whitelist: String(Number(stats.whitelist_selected_count || 0)),
    whitelist_skipped: String(Number(stats.whitelist_skipped_count || 0)),
    unknown: String(Number(stats.unknown_count || 0)),
  };
}

function renderTemplateString(template, variables) {
  return String(template || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => String(variables[key] ?? ""));
}

function buildReportSummaryHtml(stats, settings, dateKey = "") {
  const vars = reportTemplateVars(dateKey, stats);
  return textToSafeHtml(renderTemplateString(settings.report_body_template, vars));
}

function selectSubscriptionNodes(nodes, settings = DEFAULT_SETTINGS) {
  let selected = Array.isArray(nodes) ? [...nodes] : [];
  if (String(settings.subscription_shuffle || "0") === "1") {
    selected.sort((a, b) => stableTextHash(String(a.fingerprint || a.raw_uri || a.host || "")) - stableTextHash(String(b.fingerprint || b.raw_uri || b.host || "")));
  }
  const maxNodes = clampNumber(settings.subscription_max_nodes, 0, 100000, 0);
  if (maxNodes > 0 && selected.length > maxNodes) selected = selected.slice(0, maxNodes);
  return selected;
}

function stableTextHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildClashSubscription(nodes, settings = DEFAULT_SETTINGS) {
  const proxies = [];
  const usedNames = new Map();
  selectSubscriptionNodes(nodes, settings).forEach((node, index) => {
    if (!node.clash_json) return;
    try {
      const proxy = JSON.parse(node.clash_json);
      const baseName = outputNodeName(node, index + 1, settings);
      const count = (usedNames.get(baseName) || 0) + 1;
      usedNames.set(baseName, count);
      proxy.name = count === 1 ? baseName : `${baseName} ${count}`;
      proxies.push(proxy);
    } catch {}
  });
  const names = proxies.map((proxy) => proxy.name);
  const groupName = cleanNodeName(settings.subscription_group_name || "节点选择").slice(0, 60);
  const config = {
    "mixed-port": 7890,
    "allow-lan": false,
    mode: "rule",
    "log-level": "info",
    proxies,
    "proxy-groups": [
      {
        name: groupName,
        type: "select",
        proxies: names.length ? names : ["DIRECT"],
      },
    ],
    rules: [`MATCH,${groupName}`],
  };
  return YAML.stringify(config, { lineWidth: 0 });
}

function buildV2raySubscription(nodes, settings = DEFAULT_SETTINGS) {
  const uris = [];
  const seen = new Set();
  selectSubscriptionNodes(nodes, settings).forEach((node, index) => {
    let raw = String(node.raw_uri || "").trim();
    if (!raw && node.clash_json) {
      try { raw = clashProxyToUri(JSON.parse(node.clash_json)) || ""; } catch {}
    }
    const uri = renameUriForSubscription(raw, outputNodeName(node, index + 1, settings));
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    uris.push(uri);
  });
  return encodeBase64Utf8(uris.join("\n") || "\n");
}


const COUNTRY_RULES = [
  ["🇭🇰 香港", /香港|hong\s*kong|(?:^|[^a-z])hk(?:[^a-z]|$)/i],
  ["🇹🇼 台湾", /台湾|台灣|taiwan|(?:^|[^a-z])tw(?:[^a-z]|$)/i],
  ["🇯🇵 日本", /日本|东京|東京|大阪|japan|tokyo|osaka|(?:^|[^a-z])jp(?:[^a-z]|$)/i],
  ["🇸🇬 新加坡", /新加坡|狮城|獅城|singapore|(?:^|[^a-z])sg(?:[^a-z]|$)/i],
  ["🇺🇸 美国", /美国|美國|洛杉矶|洛杉磯|圣何塞|聖何塞|西雅图|西雅圖|纽约|紐約|达拉斯|達拉斯|united\s*states|america|los\s*angeles|san\s*jose|seattle|new\s*york|dallas|(?:^|[^a-z])us(?:[^a-z]|$)|(?:^|[^a-z])usa(?:[^a-z]|$)/i],
  ["🇬🇧 英国", /英国|英國|伦敦|倫敦|united\s*kingdom|britain|london|(?:^|[^a-z])uk(?:[^a-z]|$)|(?:^|[^a-z])gb(?:[^a-z]|$)/i],
  ["🇰🇷 韩国", /韩国|韓國|首尔|首爾|korea|seoul|(?:^|[^a-z])kr(?:[^a-z]|$)/i],
  ["🇨🇦 加拿大", /加拿大|多伦多|多倫多|温哥华|溫哥華|canada|toronto|vancouver|(?:^|[^a-z])ca(?:[^a-z]|$)/i],
  ["🇩🇪 德国", /德国|德國|法兰克福|法蘭克福|germany|frankfurt|(?:^|[^a-z])de(?:[^a-z]|$)/i],
  ["🇫🇷 法国", /法国|法國|巴黎|france|paris|(?:^|[^a-z])fr(?:[^a-z]|$)/i],
  ["🇳🇱 荷兰", /荷兰|荷蘭|阿姆斯特丹|netherlands|holland|amsterdam|(?:^|[^a-z])nl(?:[^a-z]|$)/i],
  ["🇷🇺 俄罗斯", /俄罗斯|俄羅斯|莫斯科|russia|moscow|(?:^|[^a-z])ru(?:[^a-z]|$)/i],
  ["🇦🇺 澳大利亚", /澳大利亚|澳大利亞|澳洲|悉尼|墨尔本|墨爾本|australia|sydney|melbourne|(?:^|[^a-z])au(?:[^a-z]|$)/i],
  ["🇮🇳 印度", /印度|孟买|孟買|india|mumbai|(?:^|[^a-z])in(?:[^a-z]|$)/i],
  ["🇹🇷 土耳其", /土耳其|伊斯坦布尔|伊斯坦堡|turkey|istanbul|(?:^|[^a-z])tr(?:[^a-z]|$)/i],
  ["🇧🇷 巴西", /巴西|圣保罗|聖保羅|brazil|sao\s*paulo|(?:^|[^a-z])br(?:[^a-z]|$)/i],
  ["🇨🇭 瑞士", /瑞士|switzerland|zurich|苏黎世|蘇黎世|(?:^|[^a-z])ch(?:[^a-z]|$)/i],
  ["🇸🇪 瑞典", /瑞典|sweden|stockholm|斯德哥尔摩|斯德哥爾摩|(?:^|[^a-z])se(?:[^a-z]|$)/i],
  ["🇫🇮 芬兰", /芬兰|芬蘭|finland|helsinki|赫尔辛基|赫爾辛基|(?:^|[^a-z])fi(?:[^a-z]|$)/i],
  ["🇵🇱 波兰", /波兰|波蘭|poland|warsaw|华沙|華沙|(?:^|[^a-z])pl(?:[^a-z]|$)/i],
  ["🇪🇸 西班牙", /西班牙|spain|madrid|马德里|馬德里|(?:^|[^a-z])es(?:[^a-z]|$)/i],
  ["🇮🇹 意大利", /意大利|italy|milan|米兰|米蘭|(?:^|[^a-z])it(?:[^a-z]|$)/i],
  ["🇦🇪 阿联酋", /阿联酋|阿聯酋|迪拜|dubai|united\s*arab\s*emirates|(?:^|[^a-z])ae(?:[^a-z]|$)/i],
  ["🇻🇳 越南", /越南|vietnam|河内|河內|hanoi|(?:^|[^a-z])vn(?:[^a-z]|$)/i],
  ["🇹🇭 泰国", /泰国|泰國|曼谷|thailand|bangkok|(?:^|[^a-z])th(?:[^a-z]|$)/i],
  ["🇲🇾 马来西亚", /马来西亚|馬來西亞|吉隆坡|malaysia|kuala\s*lumpur|(?:^|[^a-z])my(?:[^a-z]|$)/i],
  ["🇮🇩 印度尼西亚", /印度尼西亚|印度尼西亞|印尼|雅加达|雅加達|indonesia|jakarta|(?:^|[^a-z])id(?:[^a-z]|$)/i],
  ["🇵🇭 菲律宾", /菲律宾|菲律賓|马尼拉|馬尼拉|philippines|manila|(?:^|[^a-z])ph(?:[^a-z]|$)/i],
  ["🇲🇽 墨西哥", /墨西哥|mexico|(?:^|[^a-z])mx(?:[^a-z]|$)/i],
  ["🇿🇦 南非", /南非|south\s*africa|johannesburg|约翰内斯堡|約翰內斯堡|(?:^|[^a-z])za(?:[^a-z]|$)/i],
  ["🇮🇱 以色列", /以色列|israel|tel\s*aviv|特拉维夫|特拉維夫|(?:^|[^a-z])il(?:[^a-z]|$)/i],
  ["🇺🇦 乌克兰", /乌克兰|烏克蘭|ukraine|kyiv|基辅|基輔|(?:^|[^a-z])ua(?:[^a-z]|$)/i],
  ["🇳🇿 新西兰", /新西兰|新西蘭|new\s*zealand|auckland|奥克兰|奧克蘭|(?:^|[^a-z])nz(?:[^a-z]|$)/i],
];

const FLAG_COUNTRY_MAP = new Map(COUNTRY_RULES.map(([label]) => [label.slice(0, 4), label]));

function detectCountryLabel(value) {
  const name = String(value || "");
  const flag = name.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)?.[0] || "";
  if (flag && FLAG_COUNTRY_MAP.has(flag)) return FLAG_COUNTRY_MAP.get(flag);
  for (const [label, pattern] of COUNTRY_RULES) if (pattern.test(name)) return label;
  return flag;
}

function compactOutputNodeName(value) {
  return cleanNodeName(String(value || "")
    .replace(/\s*[·•|｜]+\s*(?=[·•|｜]|$)/g, " ")
    .replace(/^[\s·•|｜_-]+|[\s·•|｜_-]+$/g, "")
    .replace(/\s{2,}/g, " "));
}

function outputNodeName(node, index, settings = DEFAULT_SETTINGS) {
  const prefix = cleanNodeName(settings.node_name_prefix || "Cactus").slice(0, 30);
  const country = detectCountryLabel(node.name);
  const variables = {
    prefix,
    country,
    index: String(index).padStart(3, "0"),
    host: String(node.host || ""),
  };
  const rendered = renderTemplateString(settings.node_name_template, variables);
  return compactOutputNodeName(rendered || `${country ? `${country} ` : ""}${prefix} ${variables.index}`);
}

function renameUriForSubscription(raw, name) {
  if (!raw) return "";
  try {
    if (raw.toLowerCase().startsWith("vmess://")) {
      const payload = raw.slice("vmess://".length).split("#")[0].trim();
      const json = JSON.parse(decodeBase64Utf8(payload));
      json.ps = name;
      return `vmess://${encodeBase64Utf8(JSON.stringify(json))}`;
    }
    if (raw.toLowerCase().startsWith("ssr://")) {
      const decoded = decodeBase64Utf8(raw.slice("ssr://".length));
      const [base, query = ""] = decoded.split("/?", 2);
      const params = new URLSearchParams(query);
      params.set("remarks", encodeBase64UrlUtf8(name));
      const rebuilt = `${base}/?${params.toString()}`;
      return `ssr://${encodeBase64UrlUtf8(rebuilt)}`;
    }
    const withoutHash = raw.split("#")[0];
    return `${withoutHash}#${encodeURIComponent(name)}`;
  } catch {
    return raw;
  }
}

async function cacheRunSubscriptions(env, runId, clashContent, v2rayContent, setLatest = false) {
  const puts = [
    putKvContent(env, `report:${runId}:clash`, clashContent),
    putKvContent(env, `report:${runId}:v2ray`, v2rayContent),
  ];
  if (setLatest) {
    puts.push(
      putKvContent(env, "latest:clash", clashContent),
      putKvContent(env, "latest:v2ray", v2rayContent),
      env.CACHE.put("latest:run", String(runId)),
    );
  }
  await Promise.all(puts);
}

async function putKvContent(env, key, content) {
  const value = String(content ?? "");
  const manifestKey = `${key}:manifest`;
  const oldManifest = safeJsonParse(await env.CACHE.get(manifestKey), null);
  const bytes = new TextEncoder().encode(value).byteLength;
  const directLimit = 20 * 1024 * 1024;
  if (bytes <= directLimit) {
    await env.CACHE.put(key, value);
    await env.CACHE.delete(manifestKey);
    if (oldManifest?.parts) {
      await Promise.all(Array.from({ length: Number(oldManifest.parts) }, (_, i) => env.CACHE.delete(`${key}:part:${i}`)));
    }
    return { sharded: false, parts: 1, bytes };
  }

  // KV 单值有大小上限。大订阅按字符安全分片，读取时再拼接。
  const charChunkSize = 5_000_000;
  const parts = [];
  for (let offset = 0; offset < value.length; offset += charChunkSize) {
    parts.push(value.slice(offset, offset + charChunkSize));
  }
  if (parts.length > 32) throw new Error("订阅内容过大，超过当前分片上限");
  await env.CACHE.delete(key);
  for (let i = 0; i < parts.length; i += 1) {
    await env.CACHE.put(`${key}:part:${i}`, parts[i]);
  }
  await env.CACHE.put(manifestKey, JSON.stringify({ parts: parts.length, bytes }));
  const oldCount = Number(oldManifest?.parts || 0);
  if (oldCount > parts.length) {
    await Promise.all(Array.from({ length: oldCount - parts.length }, (_, i) => env.CACHE.delete(`${key}:part:${parts.length + i}`)));
  }
  return { sharded: true, parts: parts.length, bytes };
}

async function getKvContent(env, key) {
  const direct = await env.CACHE.get(key);
  if (direct !== null) return direct;
  const manifest = safeJsonParse(await env.CACHE.get(`${key}:manifest`), null);
  const partCount = Number(manifest?.parts || 0);
  if (!partCount || partCount > 32) return null;
  const parts = await Promise.all(Array.from({ length: partCount }, (_, i) => env.CACHE.get(`${key}:part:${i}`)));
  if (parts.some((part) => part === null)) return null;
  return parts.join("");
}

async function deleteKvContent(env, key) {
  const manifest = safeJsonParse(await env.CACHE.get(`${key}:manifest`), null);
  const partCount = Number(manifest?.parts || 0);
  const deletes = [env.CACHE.delete(key), env.CACHE.delete(`${key}:manifest`)];
  for (let i = 0; i < Math.min(partCount, 32); i += 1) deletes.push(env.CACHE.delete(`${key}:part:${i}`));
  await Promise.all(deletes);
}

function subscriptionValidity(publishedAt, settings = DEFAULT_SETTINGS, now = Date.now()) {
  const days = clampNumber(settings.subscription_valid_days, 1, 30, 5);
  const startedAt = Number(publishedAt || 0);
  const expiresAt = startedAt ? startedAt + days * DAY_MS : 0;
  const remainingMs = Math.max(0, expiresAt - now);
  return {
    days,
    startedAt,
    expiresAt,
    valid: Boolean(expiresAt && now < expiresAt),
    remainingMs,
    remainingHours: Math.max(0, Math.ceil(remainingMs / 3_600_000)),
    remainingDays: Math.max(0, Math.ceil(remainingMs / DAY_MS)),
  };
}

function formatExpiryTime(timestamp) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

async function contentSubscriptionUrl(env, origin, type, contentType, contentKey, runId) {
  if (!env.SUB_TOKEN || !runId) return "";
  const normalizedType = type === "clash" ? "clash" : "v2ray";
  const normalizedContentType = contentType === "article" ? "article" : "report";
  const key = String(contentKey || "");
  const signature = (await hmacHex(env.SUB_TOKEN, `${normalizedType}:${normalizedContentType}:${key}:${runId}`)).slice(0, 32);
  return `${origin}/sub/${normalizedType}/${normalizedContentType}/${encodeURIComponent(key)}/${signature}`;
}

async function serveSubscription(request, env, type) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 5 || parts[0] !== "sub" || parts[1] !== type || !env.SUB_TOKEN) {
    return new Response("请打开对应文章，在正文末尾获取订阅", {
      status: 404,
      headers: { ...securityHeaders(), "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const contentType = parts[2];
  const contentKey = decodeURIComponent(parts[3]);
  const signature = parts[4];
  let runId = 0;
  let revision = 0;
  let snapshotPublishedAt = 0;

  if (contentType === "report") {
    const row = await env.DB.prepare(
      `SELECT run_id, published_at FROM reports WHERE date_key=? AND published=1`
    ).bind(contentKey).first();
    runId = Number(row?.run_id || 0);
    revision = Number(row?.published_at || 0);
    snapshotPublishedAt = Number(row?.published_at || 0);
  } else if (contentType === "article") {
    const row = await env.DB.prepare(
      `SELECT a.subscription_run_id AS run_id,
              MAX(a.updated_at, r.published_at) AS revision,
              r.published_at AS snapshot_published_at
       FROM articles a
       JOIN reports r ON r.run_id=a.subscription_run_id AND r.published=1
       WHERE a.slug=? AND a.published=1`
    ).bind(contentKey).first();
    runId = Number(row?.run_id || 0);
    revision = Number(row?.revision || 0);
    snapshotPublishedAt = Number(row?.snapshot_published_at || 0);
  } else {
    return new Response("Not Found", {
      status: 404,
      headers: { ...securityHeaders(), "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (!runId) {
    return new Response("该文章订阅不存在或已下架", {
      status: 404,
      headers: { ...securityHeaders(), "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const expected = (await hmacHex(env.SUB_TOKEN, `${type}:${contentType}:${contentKey}:${runId}`)).slice(0, 32);
  if (!(await timingSafeEqual(signature, expected))) {
    return new Response("Not Found", {
      status: 404,
      headers: { ...securityHeaders(), "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const settings = await getSettings(env);
  const validity = subscriptionValidity(snapshotPublishedAt, settings);
  if (!validity.valid) {
    return new Response(
      `${settings.subscription_expired_title}\n\n${settings.subscription_expired_text}\n\n最新文章：${url.origin}/`,
      {
        status: 410,
        headers: {
          ...securityHeaders(),
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "X-Subscription-Expired": "1",
        },
      }
    );
  }

  const key = `report:${runId}:${type}`;
  let content = await getKvContent(env, key);
  if (content === null) {
    const nodes = await getAliveNodesForRun(env, runId);
    content = type === "clash" ? buildClashSubscription(nodes, settings) : buildV2raySubscription(nodes, settings);
    await putKvContent(env, key, content);
  }

  const etag = `"${runId}-${revision}-${type}-${APP_VERSION}"`;
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        ...securityHeaders(),
        "X-Robots-Tag": "noindex, nofollow",
        "X-Subscription-Expires": new Date(validity.expiresAt).toISOString(),
      },
    });
  }

  const filenameKey = String(contentKey).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "subscription";
  const headers = {
    ...securityHeaders(),
    "Content-Type": type === "clash" ? "text/yaml; charset=utf-8" : "text/plain; charset=utf-8",
    "Cache-Control": "private, max-age=300",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Subscription-Expires": new Date(validity.expiresAt).toISOString(),
    ETag: etag,
    "Content-Disposition": `inline; filename="cactus-${filenameKey}-${type}.${type === "clash" ? "yaml" : "txt"}"`,
  };
  return new Response(content, { headers });
}

async function parseSourceContent(input) {
  let text = String(input || "").replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  const decoded = tryDecodeWholeSubscription(text);
  if (decoded) text = decoded;

  const nodes = [];
  if (/^\s*(proxies|proxy-providers)\s*:/m.test(text)) {
    try {
      const doc = YAML.parse(text);
      if (Array.isArray(doc?.proxies)) {
        for (const proxy of doc.proxies) {
          const node = await normalizeClashProxy(proxy);
          if (node) nodes.push(node);
        }
      }
    } catch (error) {
      console.warn("clash yaml parse failed", friendlyError(error));
    }
  }

  const uriRegex = /(?:vmess|vless|trojan|ss|ssr|hysteria2|hy2|tuic|socks5|http):\/\/[^\s<>"']+/gi;
  const candidates = new Set();
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) candidates.add(value);
  }
  for (const match of text.matchAll(uriRegex)) candidates.add(match[0]);

  for (const raw of candidates) {
    const node = await normalizeUriNode(raw);
    if (node) nodes.push(node);
  }
  return nodes;
}

async function normalizeClashProxy(proxy) {
  if (!proxy || typeof proxy !== "object") return null;
  const protocol = String(proxy.type || "").toLowerCase();
  const host = String(proxy.server || "").trim();
  const port = Number(proxy.port);
  if (!protocol || !host || !Number.isInteger(port) || port < 1 || port > 65535) return null;

  const name = cleanNodeName(proxy.name || `${protocol}-${host}:${port}`);
  const normalized = { ...proxy, name };
  const rawUri = clashProxyToUri(normalized);
  const canonicalProxy = { ...normalized };
  delete canonicalProxy.name;
  const canonical = `clash:${stableStringify(canonicalProxy)}`;
  return {
    fingerprint: await sha256Hex(canonical),
    raw_uri: rawUri,
    clash_json: JSON.stringify(normalized),
    name,
    protocol,
    host,
    port,
    tls: inferClashTls(normalized),
  };
}

async function normalizeUriNode(rawInput) {
  const raw = String(rawInput || "").trim().replace(/[),.;]+$/, "");
  const protocol = raw.slice(0, raw.indexOf(":")).toLowerCase();
  try {
    if (protocol === "vmess") return normalizeVmess(raw);
    if (protocol === "ss") return normalizeShadowsocks(raw);
    if (protocol === "ssr") return normalizeSsr(raw);

    const url = new URL(raw);
    const host = url.hostname;
    const port = Number(url.port || defaultPortForProtocol(protocol));
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
    const name = cleanNodeName(decodeURIComponent(url.hash.slice(1)) || `${protocol}-${host}:${port}`);
    const rawWithoutName = `${url.protocol}//${url.username}${url.password ? `:${url.password}` : ""}@${url.host}${url.pathname}${url.search}`;
    const clash = uriUrlToClash(protocol, url, name);
    return {
      fingerprint: await sha256Hex(`${protocol}:${rawWithoutName}`),
      raw_uri: raw,
      clash_json: clash ? JSON.stringify(clash) : null,
      name,
      protocol,
      host,
      port,
      tls: inferUriTls(protocol, url),
    };
  } catch {
    return null;
  }
}

async function normalizeVmess(raw) {
  const payload = raw.slice("vmess://".length).split("#")[0].trim();
  const json = JSON.parse(decodeBase64Utf8(payload));
  const host = String(json.add || "").trim();
  const port = Number(json.port);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  const name = cleanNodeName(json.ps || `vmess-${host}:${port}`);
  const canonicalJson = { ...json };
  delete canonicalJson.ps;
  const clash = vmessJsonToClash(json, name);
  return {
    fingerprint: await sha256Hex(`vmess:${stableStringify(canonicalJson)}`),
    raw_uri: raw,
    clash_json: JSON.stringify(clash),
    name,
    protocol: "vmess",
    host,
    port,
    tls: ["tls", "reality"].includes(String(json.tls || "").toLowerCase()),
  };
}

async function normalizeShadowsocks(raw) {
  const value = raw.slice("ss://".length);
  const [mainPart, fragment = ""] = value.split("#", 2);
  const name = cleanNodeName(fragment ? decodeURIComponent(fragment) : "Shadowsocks");
  let method = "";
  let password = "";
  let host = "";
  let port = 0;

  if (mainPart.includes("@")) {
    const at = mainPart.lastIndexOf("@");
    const credentialsRaw = mainPart.slice(0, at);
    const serverRaw = mainPart.slice(at + 1).split("?")[0];
    const credentials = credentialsRaw.includes(":") ? decodeURIComponent(credentialsRaw) : decodeBase64Utf8(credentialsRaw);
    [method, password] = splitOnce(credentials, ":");
    ({ host, port } = parseHostPort(serverRaw));
  } else {
    const decoded = decodeBase64Utf8(mainPart.split("?")[0]);
    const at = decoded.lastIndexOf("@");
    const credentials = decoded.slice(0, at);
    const serverRaw = decoded.slice(at + 1);
    [method, password] = splitOnce(credentials, ":");
    ({ host, port } = parseHostPort(serverRaw));
  }
  if (!method || !password || !host || !port) return null;
  const clash = { name, type: "ss", server: host, port, cipher: method, password, udp: true };
  return {
    fingerprint: await sha256Hex(`ss:${method}:${password}@${host}:${port}`),
    raw_uri: raw,
    clash_json: JSON.stringify(clash),
    name,
    protocol: "ss",
    host,
    port,
    tls: false,
  };
}

async function normalizeSsr(raw) {
  try {
    const decoded = decodeBase64Utf8(raw.slice("ssr://".length));
    const [base, query = ""] = decoded.split("/?", 2);
    const parts = base.split(":");
    if (parts.length < 6) return null;
    const passwordEncoded = parts.pop();
    const obfs = parts.pop();
    const method = parts.pop();
    const protocol = parts.pop();
    const port = Number(parts.pop());
    const host = parts.join(":");
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
    const password = decodeBase64Utf8(passwordEncoded);
    const params = new URLSearchParams(query);
    const remarksRaw = params.get("remarks") || "";
    const name = cleanNodeName(remarksRaw ? decodeBase64Utf8(remarksRaw) : `SSR-${host}:${port}`);
    const protocolParam = params.get("protoparam") ? decodeBase64Utf8(params.get("protoparam")) : "";
    const obfsParam = params.get("obfsparam") ? decodeBase64Utf8(params.get("obfsparam")) : "";
    const clash = {
      name,
      type: "ssr",
      server: host,
      port,
      cipher: method,
      password,
      protocol,
      obfs,
      udp: true,
    };
    if (protocolParam) clash["protocol-param"] = protocolParam;
    if (obfsParam) clash["obfs-param"] = obfsParam;
    return {
      fingerprint: await sha256Hex(`ssr:${host}:${port}:${protocol}:${method}:${obfs}:${password}:${protocolParam}:${obfsParam}`),
      raw_uri: raw,
      clash_json: JSON.stringify(clash),
      name,
      protocol: "ssr",
      host,
      port,
      tls: false,
    };
  } catch {
    return null;
  }
}

function uriUrlToClash(protocol, url, name) {
  const host = url.hostname;
  const port = Number(url.port || defaultPortForProtocol(protocol));
  const params = url.searchParams;
  const network = (params.get("type") || params.get("network") || "tcp").toLowerCase();
  const security = (params.get("security") || "").toLowerCase();
  const servername = params.get("sni") || params.get("servername") || undefined;
  const common = { name, server: host, port, udp: true };

  if (protocol === "vless") {
    const proxy = {
      ...common,
      type: "vless",
      uuid: decodeURIComponent(url.username),
      tls: security === "tls" || security === "reality",
      network,
    };
    if (servername) proxy.servername = servername;
    if (params.get("flow")) proxy.flow = params.get("flow");
    if (security === "reality") {
      proxy["reality-opts"] = {
        "public-key": params.get("pbk") || "",
        "short-id": params.get("sid") || "",
      };
      proxy["client-fingerprint"] = params.get("fp") || "chrome";
    }
    applyNetworkOptions(proxy, params, network);
    return proxy;
  }

  if (protocol === "trojan") {
    const proxy = {
      ...common,
      type: "trojan",
      password: decodeURIComponent(url.username || url.password),
      sni: servername || host,
      network,
    };
    applyNetworkOptions(proxy, params, network);
    return proxy;
  }

  if (protocol === "hysteria2" || protocol === "hy2") {
    return {
      ...common,
      type: "hysteria2",
      password: decodeURIComponent(url.username || url.password),
      sni: servername || host,
      "skip-cert-verify": params.get("insecure") === "1",
    };
  }

  if (protocol === "tuic") {
    return {
      ...common,
      type: "tuic",
      uuid: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      sni: servername || host,
      "skip-cert-verify": params.get("allow_insecure") === "1",
    };
  }

  if (protocol === "socks5") {
    return {
      ...common,
      type: "socks5",
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      tls: params.get("tls") === "1",
    };
  }

  if (protocol === "http") {
    return {
      ...common,
      type: "http",
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      tls: params.get("tls") === "1",
    };
  }

  return null;
}

function vmessJsonToClash(json, name) {
  const network = String(json.net || "tcp").toLowerCase();
  const proxy = {
    name,
    type: "vmess",
    server: String(json.add),
    port: Number(json.port),
    uuid: String(json.id),
    alterId: Number(json.aid || 0),
    cipher: String(json.scy || "auto"),
    udp: true,
    tls: ["tls", "reality"].includes(String(json.tls || "").toLowerCase()),
    network,
  };
  if (json.sni) proxy.servername = String(json.sni);
  if (network === "ws") {
    proxy["ws-opts"] = { path: json.path || "/" };
    if (json.host) proxy["ws-opts"].headers = { Host: String(json.host) };
  } else if (network === "grpc") {
    proxy["grpc-opts"] = { "grpc-service-name": json.path || "" };
  }
  return proxy;
}

function applyNetworkOptions(proxy, params, network) {
  if (network === "ws") {
    proxy["ws-opts"] = { path: params.get("path") || "/" };
    const hostHeader = params.get("host");
    if (hostHeader) proxy["ws-opts"].headers = { Host: hostHeader };
  } else if (network === "grpc") {
    proxy["grpc-opts"] = { "grpc-service-name": params.get("serviceName") || params.get("service-name") || "" };
  }
}

function clashProxyToUri(proxy) {
  try {
    const type = String(proxy.type || "").toLowerCase();
    const hostPort = formatHostPort(proxy.server, proxy.port);
    const name = encodeURIComponent(proxy.name || type);

    if (type === "vmess") {
      const json = {
        v: "2",
        ps: proxy.name || "vmess",
        add: proxy.server,
        port: String(proxy.port),
        id: proxy.uuid,
        aid: String(proxy.alterId || 0),
        scy: proxy.cipher || "auto",
        net: proxy.network || "tcp",
        type: "none",
        host: proxy["ws-opts"]?.headers?.Host || "",
        path: proxy["ws-opts"]?.path || proxy["grpc-opts"]?.["grpc-service-name"] || "",
        tls: proxy.tls ? "tls" : "",
        sni: proxy.servername || "",
      };
      return `vmess://${encodeBase64Utf8(JSON.stringify(json))}`;
    }

    if (type === "vless") {
      const params = new URLSearchParams();
      params.set("encryption", "none");
      params.set("security", proxy["reality-opts"] ? "reality" : proxy.tls ? "tls" : "none");
      if (proxy.network) params.set("type", proxy.network);
      if (proxy.servername) params.set("sni", proxy.servername);
      if (proxy.flow) params.set("flow", proxy.flow);
      if (proxy["ws-opts"]?.path) params.set("path", proxy["ws-opts"].path);
      if (proxy["ws-opts"]?.headers?.Host) params.set("host", proxy["ws-opts"].headers.Host);
      if (proxy["grpc-opts"]?.["grpc-service-name"]) params.set("serviceName", proxy["grpc-opts"]["grpc-service-name"]);
      if (proxy["reality-opts"]?.["public-key"]) params.set("pbk", proxy["reality-opts"]["public-key"]);
      if (proxy["reality-opts"]?.["short-id"]) params.set("sid", proxy["reality-opts"]["short-id"]);
      return `vless://${encodeURIComponent(proxy.uuid)}@${hostPort}?${params.toString()}#${name}`;
    }

    if (type === "trojan") {
      const params = new URLSearchParams();
      params.set("security", "tls");
      if (proxy.sni) params.set("sni", proxy.sni);
      if (proxy.network) params.set("type", proxy.network);
      if (proxy["ws-opts"]?.path) params.set("path", proxy["ws-opts"].path);
      if (proxy["ws-opts"]?.headers?.Host) params.set("host", proxy["ws-opts"].headers.Host);
      return `trojan://${encodeURIComponent(proxy.password)}@${hostPort}?${params.toString()}#${name}`;
    }

    if (type === "ss") {
      const user = encodeBase64Utf8(`${proxy.cipher}:${proxy.password}`).replace(/=+$/g, "");
      return `ss://${user}@${hostPort}#${name}`;
    }

    if (type === "hysteria2") {
      const params = new URLSearchParams();
      if (proxy.sni) params.set("sni", proxy.sni);
      if (proxy["skip-cert-verify"]) params.set("insecure", "1");
      return `hysteria2://${encodeURIComponent(proxy.password)}@${hostPort}?${params.toString()}#${name}`;
    }

    if (type === "tuic") {
      const params = new URLSearchParams();
      if (proxy.sni) params.set("sni", proxy.sni);
      return `tuic://${encodeURIComponent(proxy.uuid)}:${encodeURIComponent(proxy.password)}@${hostPort}?${params.toString()}#${name}`;
    }


    if (type === "socks5" || type === "socks") {
      const auth = proxy.username || proxy.password
        ? `${encodeURIComponent(proxy.username || "")}:${encodeURIComponent(proxy.password || "")}@`
        : "";
      return `socks5://${auth}${hostPort}#${name}`;
    }

    if (type === "http") {
      const auth = proxy.username || proxy.password
        ? `${encodeURIComponent(proxy.username || "")}:${encodeURIComponent(proxy.password || "")}@`
        : "";
      const params = new URLSearchParams();
      if (proxy.tls) params.set("tls", "1");
      return `http://${auth}${hostPort}${params.size ? `?${params.toString()}` : ""}#${name}`;
    }

    if (type === "ssr") {
      const base = [
        proxy.server,
        proxy.port,
        proxy.protocol || "origin",
        proxy.cipher,
        proxy.obfs || "plain",
        encodeBase64UrlUtf8(proxy.password || ""),
      ].join(":");
      const params = new URLSearchParams();
      params.set("remarks", encodeBase64UrlUtf8(proxy.name || "SSR"));
      if (proxy["protocol-param"]) params.set("protoparam", encodeBase64UrlUtf8(proxy["protocol-param"]));
      if (proxy["obfs-param"]) params.set("obfsparam", encodeBase64UrlUtf8(proxy["obfs-param"]));
      return `ssr://${encodeBase64UrlUtf8(`${base}/?${params.toString()}`)}`;
    }
  } catch {}
  return null;
}

function inferClashTls(proxy) {
  const type = String(proxy.type || "").toLowerCase();
  return Boolean(proxy.tls || proxy.sni || proxy.servername || ["trojan", "hysteria2", "tuic"].includes(type));
}

function inferUriTls(protocol, url) {
  const security = (url.searchParams.get("security") || "").toLowerCase();
  return security === "tls" || security === "reality" || ["trojan", "hysteria2", "hy2", "tuic"].includes(protocol) || Number(url.port) === 443;
}

function tryDecodeWholeSubscription(text) {
  const compact = text.replace(/\s+/g, "");
  if (!compact || compact.includes("://") || /\bproxies\s*:/i.test(text)) return null;
  if (!/^[A-Za-z0-9+/_=-]+$/.test(compact)) return null;
  try {
    const decoded = decodeBase64Utf8(compact);
    return decoded.includes("://") || /\bproxies\s*:/i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const parsed = new URL(String(url));
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("节点源地址只允许 HTTP/HTTPS");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("抓取超时"), timeoutMs);
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": `CactusNodeDaily/${APP_VERSION}`,
        Accept: "text/plain, application/yaml, application/json, */*",
      },
    });
    if (!response.ok) throw new Error(`抓取失败：HTTP ${response.status}`);
    return await readResponseTextLimited(response, 5 * 1024 * 1024);
  } finally {
    clearTimeout(timer);
  }
}

async function readResponseTextLimited(response, maxBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("节点源内容超过 5MB");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

async function getSettings(env) {
  const rows = await env.DB.prepare(`SELECT key, value FROM settings`).all();
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries((rows.results || []).map((row) => [row.key, row.value])) };
}

async function getPublicHomeData(env, origin, options = {}) {
  const settings = await getSettings(env);
  const query = String(options.query || "").trim().slice(0, 80);
  const category = String(options.category || "").trim().slice(0, 30);
  const page = clampNumber(options.page, 1, 9999, 1);
  const perPage = clampNumber(settings.posts_per_page, 4, 20, 8);
  const offset = (page - 1) * perPage;
  const like = `%${query.replace(/[%_]/g, "")}%`;

  const unionSql = `
    SELECT 'report' AS item_type, r.id, r.date_key AS slug, r.title,
           COALESCE(m.excerpt, '') AS excerpt, '免费节点' AS category,
           '["Clash","V2Ray","免费节点"]' AS tags_json, COALESCE(m.cover_url,'') AS cover_url,
           COALESCE(m.pinned,0) AS pinned, COALESCE(v.views,0) AS views,
           r.published_at, r.stats_json
    FROM reports r
    LEFT JOIN report_meta m ON m.report_id=r.id
    LEFT JOIN content_views v ON v.content_type='report' AND v.content_id=r.id
    WHERE r.published=1
    UNION ALL
    SELECT 'article' AS item_type, a.id, a.slug, a.title, a.excerpt, a.category,
           a.tags_json, COALESCE(a.cover_url,'') AS cover_url, a.pinned, a.views,
           a.published_at, '{}' AS stats_json
    FROM articles a WHERE a.published=1`;

  const where=[]; const binds=[];
  if (query) { where.push(`(title LIKE ? OR excerpt LIKE ? OR category LIKE ? OR tags_json LIKE ?)`); binds.push(like,like,like,like); }
  if (category) { where.push(`category=?`); binds.push(category); }
  const whereSql=where.length?`WHERE ${where.join(' AND ')}`:'';
  const countRow=await env.DB.prepare(`WITH items AS (${unionSql}) SELECT COUNT(*) AS count FROM items ${whereSql}`).bind(...binds).first();
  const rows=await env.DB.prepare(`WITH items AS (${unionSql}) SELECT * FROM items ${whereSql} ORDER BY pinned DESC, published_at DESC LIMIT ? OFFSET ?`).bind(...binds,perPage,offset).all();
  const featured=await env.DB.prepare(`WITH items AS (${unionSql}) SELECT * FROM items ${whereSql} ORDER BY pinned DESC, published_at DESC LIMIT 1`).bind(...binds).first();
  const latest=await env.DB.prepare(`WITH items AS (${unionSql}) SELECT * FROM items ORDER BY published_at DESC LIMIT 6`).all();
  const hot=await env.DB.prepare(`WITH items AS (${unionSql}) SELECT * FROM items ORDER BY views DESC, published_at DESC LIMIT 6`).all();
  const sourceCount=await env.DB.prepare(`SELECT COUNT(*) AS count FROM sources WHERE enabled=1`).first();
  const latestRun=await env.DB.prepare(`SELECT * FROM runs ORDER BY created_at DESC LIMIT 1`).first();
  const total=Number(countRow?.count||0);
  const mapItem=(item)=>({
    ...item,
    stats:safeJsonParse(item.stats_json,{}),
    tags:safeJsonParse(item.tags_json,[]),
    excerpt:item.excerpt || (item.item_type==='report'?'今日免费节点已经整理并更新。':'阅读全文了解详细内容。'),
    url:item.item_type==='report'?`/report/${encodeURIComponent(item.slug)}`:`/article/${encodeURIComponent(item.slug)}`,
  });
  return {
    ok:true,settings,query,category,page,per_page:perPage,total,total_pages:Math.max(1,Math.ceil(total/perPage)),
    source_count:Number(sourceCount?.count||0),latest_run:latestRun||null,
    featured:featured?mapItem(featured):null,
    reports:(rows.results||[]).map(mapItem),
    latest:(latest.results||[]).map(mapItem),
    hot:(hot.results||[]).map(mapItem),
    categories:[
      {name:'免费节点',slug:'free-nodes',desc:settings.category_nodes_description},
      {name:'机场推荐',slug:'airports',desc:settings.category_airport_description},
    ],
  };
}

async function getAdminState(env, origin = "") {
  const [settings, sources, runs, reports, articles, nodeCount, sourceCount, publishedCount, latestReport, protocolStats, failedSources, totalViews, sourceStats] = await Promise.all([
    getSettings(env),
    env.DB.prepare(`SELECT * FROM sources ORDER BY id DESC`).all(),
    env.DB.prepare(`SELECT * FROM runs WHERE COALESCE(admin_hidden,0)=0 ORDER BY created_at DESC LIMIT 100`).all(),
    env.DB.prepare(`SELECT r.*, COALESCE(m.excerpt, '') AS excerpt, COALESCE(m.pinned, 0) AS pinned,
      COALESCE(m.cover_url,'') AS cover_url, COALESCE(m.seo_title,'') AS seo_title,
      COALESCE(m.seo_description,'') AS seo_description
      FROM reports r LEFT JOIN report_meta m ON m.report_id=r.id ORDER BY r.created_at DESC LIMIT 200`).all(),
    env.DB.prepare(`SELECT * FROM articles ORDER BY created_at DESC LIMIT 300`).all(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM nodes WHERE enabled=1`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM sources WHERE enabled=1`).first(),
    env.DB.prepare(`SELECT (SELECT COUNT(*) FROM reports WHERE published=1)+(SELECT COUNT(*) FROM articles WHERE published=1) AS count`).first(),
    env.DB.prepare(`SELECT run_id,date_key,published_at FROM reports WHERE published=1 ORDER BY published_at DESC LIMIT 1`).first(),
    env.DB.prepare(`SELECT protocol,COUNT(*) AS total,SUM(CASE WHEN last_alive=1 THEN 1 ELSE 0 END) AS alive FROM nodes WHERE enabled=1 GROUP BY protocol ORDER BY total DESC`).all(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM sources WHERE enabled=1 AND last_error IS NOT NULL AND last_error<>''`).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(views),0) AS count FROM content_views`).first(),
    env.DB.prepare(`SELECT srs.*,r.date_key,r.created_at AS run_created_at FROM source_run_stats srs JOIN runs r ON r.id=srs.run_id WHERE r.completed_at IS NOT NULL ORDER BY r.created_at DESC LIMIT 3000`).all(),
  ]);
  let subscriptions = null;
  if (latestReport && env.SUB_TOKEN && origin && subscriptionValidity(latestReport.published_at, settings).valid) {
    subscriptions = {
      clash: await contentSubscriptionUrl(env, origin, "clash", "report", latestReport.date_key, latestReport.run_id),
      v2ray: await contentSubscriptionUrl(env, origin, "v2ray", "report", latestReport.date_key, latestReport.run_id),
      date_key: latestReport.date_key,
      expires_at: subscriptionValidity(latestReport.published_at, settings).expiresAt,
    };
  }
  return {
    ok:true,version:APP_VERSION,settings,
    sources:sources.results||[],runs:runs.results||[],
    reports:(reports.results||[]).map(r=>({...r,stats:safeJsonParse(r.stats_json,{}),body_text:htmlToPlainText(r.summary_html)})),
    articles:(articles.results||[]).map(a=>({...a,tags:safeJsonParse(a.tags_json,[]),body_text:htmlToPlainText(a.body_html)})),
    node_count:Number(nodeCount?.count||0),source_count:Number(sourceCount?.count||0),published_count:Number(publishedCount?.count||0),
    protocol_stats:(protocolStats.results||[]).map(row=>({protocol:row.protocol,total:Number(row.total||0),alive:Number(row.alive||0)})),
    failed_source_count:Number(failedSources?.count||0),
    total_views:Number(totalViews?.count||0),
    source_stats:(sourceStats.results||[]).map(row=>({
      ...row,
      fetched_count:Number(row.fetched_count||0),unique_count:Number(row.unique_count||0),config_pass:Number(row.config_pass||0),
      transport_pass:Number(row.transport_pass||0),verified_count:Number(row.verified_count||0),included_count:Number(row.included_count||0),
      exclusive_count:Number(row.exclusive_count||0),cf_unknown_count:Number(row.cf_unknown_count||0),failed_count:Number(row.failed_count||0),
      trusted_retained_count:Number(row.trusted_retained_count||0),whitelist_selected_count:Number(row.whitelist_selected_count||0),whitelist_skipped_count:Number(row.whitelist_skipped_count||0),
      direct_count:Number(row.direct_count||0),cf_native_count:Number(row.cf_native_count||0),cf_cdn_count:Number(row.cf_cdn_count||0),unknown_type_count:Number(row.unknown_type_count||0),
    })),
    subscriptions,
    server_time: Date.now(),
  };
}


function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function seoHeadHtml({ title, description, canonical, origin, settings, type = "website", image, robots = "index,follow", publishedAt, modifiedAt }) {
  const imageUrl = image || `${origin}/og.svg`;
  const keywords = settings.seo_keywords ? `<meta name="keywords" content="${escapeHtml(settings.seo_keywords)}">` : "";
  return `<title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  ${keywords}<link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest">
  <meta property="og:locale" content="zh_CN"><meta property="og:type" content="${escapeHtml(type)}"><meta property="og:site_name" content="${escapeHtml(settings.site_name)}">
  <meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(imageUrl)}">
  ${publishedAt ? `<meta property="article:published_time" content="${new Date(Number(publishedAt)).toISOString()}">` : ""}${modifiedAt ? `<meta property="article:modified_time" content="${new Date(Number(modifiedAt)).toISOString()}">` : ""}
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(imageUrl)}">`;
}

function themeOverrides(settings = DEFAULT_SETTINGS) {
  const color = (value, fallback) => /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? String(value) : fallback;
  const primary = color(settings.theme_primary, "#2563eb");
  const ink = color(settings.theme_ink, "#0f172a");
  const background = color(settings.theme_background, "#f4f7fb");
  const radius = clampNumber(settings.theme_radius, 8, 36, 16);
  return `<style>:root{--brand:${primary};--ink:${ink};--page:${background};--radius:${radius}px}</style>`;
}

function siteLogoMark(settings = DEFAULT_SETTINGS) {
  if (settings.site_logo_url) {
    return `<img src="${escapeHtml(settings.site_logo_url)}" alt="" loading="eager">`;
  }
  return `<span>${escapeHtml(String(settings.site_logo_letter || "C").slice(0, 2))}</span>`;
}

function faqItems(settings) {
  return [1, 2, 3].map((index) => ({
    q: String(settings[`faq_${index}_q`] || "").trim(),
    a: String(settings[`faq_${index}_a`] || "").trim(),
  })).filter((item) => item.q && item.a);
}

function faqSectionHtml(settings) {
  const items = faqItems(settings);
  if (!items.length) return "";
  return `<section class="faq-section"><div class="section-heading"><span>${escapeHtml(settings.faq_section_badge)}</span><h2>${escapeHtml(settings.faq_section_title)}</h2></div><div class="faq-list">${items.map((item, index) => `<details ${index === 0 ? "open" : ""}><summary>${escapeHtml(item.q)}<i>+</i></summary><p>${escapeHtml(item.a)}</p></details>`).join("")}</div></section>`;
}

function renderFaviconSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#0a0f0c"/><path d="M32 12c-8.8 0-16 7.2-16 16v8c0 8.8 7.2 16 16 16 6.7 0 12.4-4.1 14.8-10h-10A8 8 0 0 1 24 36v-8a8 8 0 0 1 12.8-6.4h10C44.4 15.9 38.7 12 32 12Z" fill="#8bffb2"/><circle cx="45" cy="22" r="4" fill="#fff"/></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400", ...securityHeaders() } });
}

async function renderOgSvg(env) {
  const settings = await getSettings(env);
  const latest = await env.DB.prepare(`SELECT stats_json, date_key FROM reports WHERE published=1 ORDER BY published_at DESC LIMIT 1`).first();
  const stats = safeJsonParse(latest?.stats_json, {});
  const alive = Number(stats.alive_count || 0);
  const unique = Number(stats.unique_count || 0);
  const subtitle = latest ? `${humanDateFromDateKey(latest.date_key)} · ${alive} 条进入订阅 / ${unique} 条参与三步检查` : settings.site_subtitle;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0a0f0c"/><stop offset="1" stop-color="#14271b"/></linearGradient><radialGradient id="r"><stop stop-color="#7cffab" stop-opacity=".25"/><stop offset="1" stop-color="#7cffab" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="930" cy="70" r="420" fill="url(#r)"/><g fill="none" stroke="#8bffb2" stroke-opacity=".18"><path d="M0 500C300 380 430 590 720 440s350-80 480-150"/><path d="M0 545C310 430 450 620 750 485s330-90 450-180"/></g><rect x="76" y="72" width="72" height="72" rx="22" fill="#8bffb2"/><path d="M112 88c-13 0-24 11-24 24v8c0 13 11 24 24 24 10 0 18-6 22-15h-15a12 12 0 0 1-19-9v-8a12 12 0 0 1 19-9h15c-4-9-12-15-22-15Z" fill="#0a0f0c"/><text x="76" y="210" fill="#8bffb2" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="4">DAILY NODE REPORT</text><text x="76" y="310" fill="#fff" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="72" font-weight="800">${escapeXml(settings.site_name)}</text><text x="76" y="382" fill="#c5d2c9" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="31">${escapeXml(subtitle)}</text><rect x="76" y="458" width="380" height="62" rx="31" fill="#8bffb2"/><text x="112" y="499" fill="#0a0f0c" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="24" font-weight="700">三步真实验证 · 每日更新</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=600", ...securityHeaders() } });
}

async function renderManifest(env) {
  const settings = await getSettings(env);
  return jsonResponse({ name: settings.site_name, short_name: settings.site_name.slice(0, 12), description: settings.site_description, start_url: "/", display: "standalone", background_color: settings.theme_background || "#f4f7fb", theme_color: settings.theme_primary || "#2563eb", icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }] }, 200, { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" });
}

async function getAdjacentContent(env, publishedAt) {
  const unionSql = `
    SELECT 'report' AS item_type,id,date_key AS slug,title,published_at FROM reports WHERE published=1
    UNION ALL
    SELECT 'article' AS item_type,id,slug,title,published_at FROM articles WHERE published=1`;
  const [newer, older] = await Promise.all([
    env.DB.prepare(`WITH items AS (${unionSql}) SELECT * FROM items WHERE published_at>? ORDER BY published_at ASC LIMIT 1`).bind(Number(publishedAt || 0)).first(),
    env.DB.prepare(`WITH items AS (${unionSql}) SELECT * FROM items WHERE published_at<? ORDER BY published_at DESC LIMIT 1`).bind(Number(publishedAt || 0)).first(),
  ]);
  const map = (item) => item ? ({
    title: item.title,
    url: item.item_type === "report" ? `/report/${encodeURIComponent(item.slug)}` : `/article/${encodeURIComponent(item.slug)}`,
  }) : null;
  return { newer: map(newer), older: map(older) };
}

function subscriptionPanelHtml({ settings, clashUrl, v2rayUrl, publishedAt }) {
  const validity = subscriptionValidity(publishedAt, settings);
  if (!validity.valid) {
    return `<section class="subscription-panel expired" id="subscriptions">
      <div class="subscription-copy">
        <span>${escapeHtml(settings.subscription_kicker)}</span>
        <h2>${escapeHtml(settings.subscription_expired_title)}</h2>
        <p>${escapeHtml(settings.subscription_expired_text)}</p>
      </div>
      <a class="subscription-latest" href="/">${escapeHtml(settings.subscription_latest_cta)} →</a>
    </section>`;
  }
  const timeText = validity.remainingHours <= 24
    ? `剩余约 ${validity.remainingHours} 小时`
    : `剩余约 ${validity.remainingDays} 天`;
  return `<section class="subscription-panel" id="subscriptions">
    <div class="subscription-copy">
      <span>${escapeHtml(settings.subscription_kicker)}</span>
      <h2>${escapeHtml(settings.subscription_title)}</h2>
      <p>${escapeHtml(settings.subscription_description)}</p>
      <div class="subscription-validity"><b>${escapeHtml(settings.subscription_expiry_label)}</b><i>${timeText} · ${formatExpiryTime(validity.expiresAt)} 到期</i></div>
    </div>
    <div class="subscription-actions">
      <a href="${escapeHtml(clashUrl)}"><strong>Clash</strong><small>${escapeHtml(settings.clash_button_text)}</small><i>↗</i></a>
      <a href="${escapeHtml(v2rayUrl)}"><strong>V2Ray</strong><small>${escapeHtml(settings.v2ray_button_text)}</small><i>↗</i></a>
      <button type="button" data-copy-sub="${escapeHtml(clashUrl)}">${escapeHtml(settings.subscription_copy_text)} Clash</button>
      <button type="button" data-copy-sub="${escapeHtml(v2rayUrl)}">${escapeHtml(settings.subscription_copy_text)} V2Ray</button>
    </div>
  </section>`;
}

async function renderHomePage(env, origin, archiveOnly = false, requestUrl = null, forcedCategory = "") {
  const url = requestUrl instanceof URL ? requestUrl : new URL(origin);
  const query = String(url.searchParams.get("q") || "").trim();
  const page = clampNumber(url.searchParams.get("page"), 1, 9999, 1);
  const data = await getPublicHomeData(env, origin, { query, page, category: forcedCategory });
  const s = data.settings;
  const featured = data.featured;
  const latestRun = data.latest_run || {};
  const list = (page === 1 && !query && !forcedCategory && featured)
    ? data.reports.filter((item) => !(item.item_type === featured.item_type && Number(item.id) === Number(featured.id)))
    : data.reports;

  const articleCards = list.map((item) => `
    <article class="story-card">
      <a class="story-cover" href="${escapeHtml(item.url)}">${postCoverHtml(item)}</a>
      <div class="story-body">
        <div class="story-meta">
          <a href="/category/${categorySlugFromName(item.category)}">${escapeHtml(item.category)}</a>
          <span>${formatDateTime(item.published_at).split(" ")[0]}</span>
          <span>${Number(item.views || 0)} ${escapeHtml(s.read_count_suffix)}</span>
        </div>
        <h2><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></h2>
        <p>${escapeHtml(item.excerpt)}</p>
        <div class="story-foot">
          <div>${(item.tags || []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          <a href="${escapeHtml(item.url)}">${escapeHtml(s.home_read_more_text)} →</a>
        </div>
      </div>
    </article>`).join("");

  const latest = (data.latest || []).slice(0, 5).map((item) => `
    <a class="mini-story" href="${escapeHtml(item.url)}">
      <b>${escapeHtml(item.title)}</b>
      <span>${formatDateTime(item.published_at).split(" ")[0]}</span>
    </a>`).join("");

  const hot = (data.hot || []).slice(0, 5).map((item, index) => `
    <a class="hot-story" href="${escapeHtml(item.url)}">
      <i>${index + 1}</i>
      <div><b>${escapeHtml(item.title)}</b><span>${Number(item.views || 0)} ${escapeHtml(s.read_count_suffix)}</span></div>
    </a>`).join("");

  const featuredCard = featured ? `
    <a class="banner-feature" href="${escapeHtml(featured.url)}">
      <span>${escapeHtml(s.home_featured_label)} · ${formatDateTime(featured.published_at).split(" ")[0]}</span>
      <h2>${escapeHtml(featured.title)}</h2>
      <p>${escapeHtml(featured.excerpt)}</p>
      <b>${escapeHtml(s.hero_read_button)} →</b>
    </a>` : `
    <div class="banner-feature empty">
      <span>${escapeHtml(s.home_featured_label)}</span>
      <h2>${escapeHtml(s.empty_title)}</h2>
      <p>${escapeHtml(s.empty_text)}</p>
    </div>`;

  const homeBanner = `
    <section class="home-banner">
      <div class="banner-copy">
        <span class="banner-badge">${escapeHtml(s.hero_badge)}</span>
        <h1>${escapeHtml(s.hero_title)}<em>${escapeHtml(s.hero_highlight)}</em></h1>
        <p>${escapeHtml(s.hero_description)}</p>
        <form class="hero-search" action="/" method="get">
          <input name="q" placeholder="${escapeHtml(s.search_placeholder)}">
          <button>${escapeHtml(s.search_button_text)}</button>
        </form>
        <div class="banner-links"><a href="/?q=Clash">Clash</a><a href="/?q=V2Ray">V2Ray</a><a href="/?q=小火箭">小火箭</a><a href="/?q=4K">1080P / 4K</a></div>
        <small>${escapeHtml(s.hero_note)}</small>
      </div>
      ${featuredCard}
    </section>`;

  const alive = Number(latestRun.alive || 0);
  const lastUpdate = latestRun.published_at || latestRun.completed_at || latestRun.created_at;
  const quickStats = `
    <section class="quick-stats">
      <div><small>${escapeHtml(s.home_stat_alive_label)}</small><b>${alive || "—"}</b></div>
      <div><small>${escapeHtml(s.home_stat_sources_label)}</small><b>${Number(data.source_count || 0)}</b></div>
      <div><small>${escapeHtml(s.home_stat_time_label)}</small><b>${lastUpdate ? formatDateTime(lastUpdate) : "等待更新"}</b></div>
      <div><small>${escapeHtml(s.home_stat_validity_label)}</small><b>${clampNumber(s.subscription_valid_days, 1, 30, 5)} 天</b></div>
    </section>`;

  const promo = s.airport_url ? `
    <a class="promo-ribbon" href="${escapeHtml(s.airport_url)}" target="_blank" rel="noopener noreferrer sponsored">
      <span>${escapeHtml(s.airport_badge)}</span>
      <b>${escapeHtml(s.airport_name)}</b>
      <p>${escapeHtml(s.airport_description)}</p>
      <i>${escapeHtml(s.airport_cta)} →</i>
    </a>` : "";

  const announcement = s.announcement_text ? `
    <div class="announcement">
      <p>${escapeHtml(s.announcement_text)}</p>
      <a href="/archive">${escapeHtml(s.announcement_link_text)} →</a>
    </div>` : "";

  const pageTitle = forcedCategory ? `${forcedCategory} - ${s.site_name}`
    : query ? `搜索“${query}” - ${s.site_name}`
    : archiveOnly ? `文章归档 - ${s.site_name}`
    : `${s.site_name} - ${s.site_subtitle}`;
  const pageDesc = forcedCategory ? `查看${forcedCategory}相关内容。`
    : query ? `搜索结果：${query}`
    : s.site_description;
  const canonical = forcedCategory ? `${origin}/category/${categorySlugFromName(forcedCategory)}`
    : archiveOnly ? `${origin}/archive`
    : `${origin}/`;

  return htmlResponse(`<!doctype html><html lang="zh-CN"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    ${seoHeadHtml({ title: pageTitle, description: pageDesc, canonical, origin, settings: s, robots: query ? "noindex,follow" : "index,follow" })}
    ${sharedStyles()}${themeOverrides(s)}
  </head><body>
    ${promo}${siteHeaderHtml(s, forcedCategory || (archiveOnly ? "archive" : "home"))}${announcement}
    <main>
      ${!archiveOnly && !query && !forcedCategory ? `${homeBanner}${quickStats}` : ""}
      <section class="content-shell">
        <div class="content-main">
          <header class="content-heading">
            <div><span>${escapeHtml(forcedCategory || (query ? "搜索结果" : archiveOnly ? "全部文章" : s.home_section_badge))}</span>
            <h2>${escapeHtml(forcedCategory ? `${forcedCategory}文章` : query ? `找到 ${data.total} 篇内容` : archiveOnly ? s.nav_archive_label : s.home_section_title)}</h2></div>
            <form class="inline-search" action="/" method="get">
              <input name="q" value="${escapeHtml(query)}" placeholder="${escapeHtml(s.search_placeholder)}">
              <button>${escapeHtml(s.search_button_text)}</button>
            </form>
          </header>
          <div class="story-list">${articleCards || `<div class="empty-state"><h3>${escapeHtml(s.empty_title)}</h3><p>${escapeHtml(s.empty_text)}</p><a href="/admin">进入后台发布第一篇</a></div>`}</div>
          ${paginationHtml(data, forcedCategory ? `/category/${categorySlugFromName(forcedCategory)}` : archiveOnly ? "/archive" : "/", query)}
        </div>
        <aside class="content-side">
          <section class="side-card status-card">
            <span>${escapeHtml(s.sidebar_status_title)}</span>
            <h3>${alive ? `今天更新 ${alive} 条` : "等待今天的更新"}</h3>
            <p>${escapeHtml(s.sidebar_status_text)}</p>
            ${featured ? `<a href="${escapeHtml(featured.url)}">打开今天的文章 →</a>` : ""}
          </section>
          ${s.telegram_url ? `<a class="side-card telegram-card" href="${escapeHtml(s.telegram_url)}" target="_blank" rel="noopener noreferrer"><span>Telegram</span><h3>${escapeHtml(s.telegram_name)}</h3><p>${escapeHtml(s.telegram_description)}</p><b>${escapeHtml(s.telegram_cta)} →</b></a>` : ""}
          ${s.airport_url ? `<a class="side-card airport-card" href="${escapeHtml(s.airport_url)}" target="_blank" rel="noopener noreferrer sponsored"><span>${escapeHtml(s.airport_badge)}</span><h3>${escapeHtml(s.airport_sidebar_title)}</h3><p>${escapeHtml(s.airport_description)}</p><b>${escapeHtml(s.airport_cta)} →</b></a>` : ""}
          <section class="side-card"><div class="side-title"><b>${escapeHtml(s.sidebar_latest_title)}</b></div>${latest || "<p>暂无内容</p>"}</section>
          <section class="side-card"><div class="side-title"><b>${escapeHtml(s.sidebar_hot_title)}</b></div>${hot || "<p>暂无内容</p>"}</section>
          <section class="side-card tags-card"><div class="side-title"><b>${escapeHtml(s.sidebar_tags_title)}</b></div><div>
            <a href="/?q=Clash">Clash</a><a href="/?q=V2Ray">V2Ray</a><a href="/?q=小火箭">小火箭</a><a href="/?q=4K">4K</a><a href="/?q=免费节点">免费节点</a>
          </div></section>
        </aside>
      </section>
      ${!archiveOnly && !query && !forcedCategory ? faqSectionHtml(s) : ""}
    </main>
    ${siteFooterHtml(s)}${publicScript(s)}
  </body></html>`);
}

async function renderCategoryPage(env,origin,slug,url){const name=categoryNameFromSlug(slug);if(!name)return htmlResponse(notFoundHtml('分类不存在'),404);return renderHomePage(env,origin,false,url,name);}

async function renderReportPage(env, origin, dateKey, ctx = null) {
  const report = await env.DB.prepare(`SELECT r.*,COALESCE(m.excerpt,'') AS excerpt,COALESCE(m.pinned,0) AS pinned,
    COALESCE(m.cover_url,'') AS cover_url,COALESCE(m.seo_title,'') AS seo_title,
    COALESCE(m.seo_description,'') AS seo_description,COALESCE(m.updated_at,r.published_at) AS updated_at,
    COALESCE(v.views,0) AS views
    FROM reports r LEFT JOIN report_meta m ON m.report_id=r.id
    LEFT JOIN content_views v ON v.content_type='report' AND v.content_id=r.id
    WHERE r.date_key=? AND r.published=1`).bind(dateKey).first();
  if (!report) return htmlResponse(notFoundHtml("文章不存在或尚未发布"), 404);
  if (ctx) ctx.waitUntil(incrementContentView(env, "report", report.id));

  const s = await getSettings(env);
  const stats = safeJsonParse(report.stats_json, {});
  const excerpt = report.excerpt || excerptFromHtml(report.summary_html, 180);
  const canonical = `${origin}/report/${encodeURIComponent(dateKey)}`;
  const clashUrl = await contentSubscriptionUrl(env, origin, "clash", "report", dateKey, report.run_id);
  const v2rayUrl = await contentSubscriptionUrl(env, origin, "v2ray", "report", dateKey, report.run_id);
  const seoTitle = report.seo_title || report.title;
  const seoDescription = report.seo_description || excerpt;
  const adjacent = await getAdjacentContent(env, report.published_at);
  const subscriptionPanel = clashUrl && v2rayUrl
    ? subscriptionPanelHtml({ settings: s, clashUrl, v2rayUrl, publishedAt: report.published_at })
    : "";

  return htmlResponse(`<!doctype html><html lang="zh-CN"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    ${seoHeadHtml({ title: `${seoTitle} - ${s.site_name}`, description: seoDescription, canonical, origin, settings: s, type: "article", image: report.cover_url || undefined, publishedAt: report.published_at, modifiedAt: report.updated_at })}
    ${sharedStyles()}${themeOverrides(s)}
  </head><body>
    <div class="reading-progress" data-reading-progress></div>
    ${siteHeaderHtml(s, "免费节点")}
    <main class="article-layout">
      <article class="article-paper">
        <nav class="breadcrumbs"><a href="/">${escapeHtml(s.nav_home_label)}</a><span>/</span><a href="/category/free-nodes">${escapeHtml(s.nav_nodes_label)}</a></nav>
        <header class="article-hero">
          <span class="article-kicker">${escapeHtml(s.nav_nodes_label)} · ${humanDateFromDateKey(dateKey)}</span>
          <h1>${escapeHtml(report.title)}</h1>
          <p>${escapeHtml(excerpt)}</p>
          <div class="article-byline">
            <span>${escapeHtml(s.site_author)}</span><i></i><span>${formatDateTime(report.published_at)}</span><i></i>
            <span>${Number(report.views || 0) + 1} ${escapeHtml(s.read_count_suffix)}</span>
            <button data-copy-url>${escapeHtml(s.copy_link_text)}</button>
          </div>
        </header>
        ${report.cover_url ? `<img class="article-cover" src="${escapeHtml(report.cover_url)}" alt="${escapeHtml(report.title)}">` : ""}
        <section class="report-numbers">
          <div><small>${escapeHtml(s.report_stat_fetched_label)}</small><b>${Number(stats.fetched_count || 0)}</b></div>
          <div><small>${escapeHtml(s.report_stat_unique_label)}</small><b>${Number(stats.unique_count || 0)}</b></div>
          <div><small>${escapeHtml(s.report_stat_alive_label)}</small><b>${Number(stats.alive_count || 0)}</b></div>
          <div><small>${escapeHtml(s.report_stat_dead_label)}</small><b>${Number(stats.dead_count || 0)}</b></div>
        </section>
        <div class="article-body">${report.summary_html}</div>
        ${subscriptionPanel}
        <section class="article-note"><b>${escapeHtml(s.article_note_title)}</b><p>${escapeHtml(s.article_note_text)}</p></section>
        ${s.telegram_url ? `<a class="article-tg" href="${escapeHtml(s.telegram_url)}" target="_blank" rel="noopener noreferrer"><span>Telegram</span><b>${escapeHtml(s.telegram_name)}</b><i>→</i></a>` : ""}
        <nav class="article-nav">
          ${adjacent.newer ? `<a href="${escapeHtml(adjacent.newer.url)}"><span>${escapeHtml(s.article_prev_label)}</span><b>${escapeHtml(adjacent.newer.title)}</b></a>` : "<span></span>"}
          ${adjacent.older ? `<a class="next" href="${escapeHtml(adjacent.older.url)}"><span>${escapeHtml(s.article_next_label)}</span><b>${escapeHtml(adjacent.older.title)}</b></a>` : "<span></span>"}
        </nav>
        <a class="back-link" href="/archive">← ${escapeHtml(s.article_back_label)}</a>
      </article>
    </main>
    ${siteFooterHtml(s)}${publicScript(s)}
  </body></html>`);
}

async function renderArticlePage(env, origin, slug, ctx = null) {
  const article = await env.DB.prepare(`SELECT a.*,p.date_key AS subscription_date_key,p.published_at AS subscription_published_at
    FROM articles a LEFT JOIN reports p ON p.run_id=a.subscription_run_id AND p.published=1
    WHERE a.slug=? AND a.published=1`).bind(slug).first();
  if (!article) return htmlResponse(notFoundHtml("文章不存在或尚未发布"), 404);
  if (ctx) ctx.waitUntil(incrementContentView(env, "article", article.id));

  const s = await getSettings(env);
  const excerpt = article.excerpt || excerptFromHtml(article.body_html, 180);
  const canonical = `${origin}/article/${encodeURIComponent(article.slug)}`;
  const tags = safeJsonParse(article.tags_json, []);
  let subscriptionDateKey = article.subscription_date_key || "";
  let subscriptionRunId = Number(article.subscription_run_id || 0);
  let subscriptionPublishedAt = Number(article.subscription_published_at || 0);

  if (!subscriptionDateKey || !subscriptionRunId) {
    const latest = await env.DB.prepare(`SELECT run_id,date_key,published_at FROM reports WHERE published=1 ORDER BY published_at DESC LIMIT 1`).first();
    if (latest) {
      subscriptionDateKey = latest.date_key;
      subscriptionRunId = Number(latest.run_id);
      subscriptionPublishedAt = Number(latest.published_at || 0);
      await env.DB.prepare(`UPDATE articles SET subscription_run_id=?, updated_at=? WHERE id=?`).bind(latest.run_id, Date.now(), article.id).run();
    }
  }

  const clashUrl = subscriptionDateKey ? await contentSubscriptionUrl(env, origin, "clash", "article", article.slug, subscriptionRunId) : "";
  const v2rayUrl = subscriptionDateKey ? await contentSubscriptionUrl(env, origin, "v2ray", "article", article.slug, subscriptionRunId) : "";
  const subscriptionPanel = clashUrl && v2rayUrl
    ? subscriptionPanelHtml({ settings: s, clashUrl, v2rayUrl, publishedAt: subscriptionPublishedAt })
    : "";
  const seoTitle = article.seo_title || article.title;
  const seoDescription = article.seo_description || excerpt;
  const adjacent = await getAdjacentContent(env, article.published_at);

  return htmlResponse(`<!doctype html><html lang="zh-CN"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    ${seoHeadHtml({ title: `${seoTitle} - ${s.site_name}`, description: seoDescription, canonical, origin, settings: s, type: "article", image: article.cover_url || undefined, publishedAt: article.published_at, modifiedAt: article.updated_at })}
    ${sharedStyles()}${themeOverrides(s)}
  </head><body>
    <div class="reading-progress" data-reading-progress></div>
    ${siteHeaderHtml(s, article.category)}
    <main class="article-layout">
      <article class="article-paper">
        <nav class="breadcrumbs"><a href="/">${escapeHtml(s.nav_home_label)}</a><span>/</span><a href="/category/${categorySlugFromName(article.category)}">${escapeHtml(article.category)}</a></nav>
        <header class="article-hero">
          <span class="article-kicker">${escapeHtml(article.category)}</span>
          <h1>${escapeHtml(article.title)}</h1>
          <p>${escapeHtml(excerpt)}</p>
          <div class="article-byline">
            <span>${escapeHtml(s.site_author)}</span><i></i><span>${formatDateTime(article.published_at)}</span><i></i>
            <span>${Number(article.views || 0) + 1} ${escapeHtml(s.read_count_suffix)}</span>
            <button data-copy-url>${escapeHtml(s.copy_link_text)}</button>
          </div>
        </header>
        ${article.cover_url ? `<img class="article-cover" src="${escapeHtml(article.cover_url)}" alt="${escapeHtml(article.title)}">` : ""}
        <div class="article-body">${article.body_html}</div>
        ${subscriptionPanel}
        ${tags.length ? `<div class="article-tags">${tags.map((tag) => `<a href="/?q=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>` : ""}
        <nav class="article-nav">
          ${adjacent.newer ? `<a href="${escapeHtml(adjacent.newer.url)}"><span>${escapeHtml(s.article_prev_label)}</span><b>${escapeHtml(adjacent.newer.title)}</b></a>` : "<span></span>"}
          ${adjacent.older ? `<a class="next" href="${escapeHtml(adjacent.older.url)}"><span>${escapeHtml(s.article_next_label)}</span><b>${escapeHtml(adjacent.older.title)}</b></a>` : "<span></span>"}
        </nav>
        <a class="back-link" href="/archive">← ${escapeHtml(s.article_back_label)}</a>
      </article>
    </main>
    ${siteFooterHtml(s)}${publicScript(s)}
  </body></html>`);
}

async function renderAboutPage(env, origin) {
  const s=await getSettings(env);const canonical=`${origin}/about`;
  return htmlResponse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${seoHeadHtml({title:`${s.about_title} - ${s.site_name}`,description:s.about_text,canonical,origin,settings:s})}${sharedStyles()}${themeOverrides(s)}</head><body>${siteHeaderHtml(s,'about')}<main class="simple-page"><span class="eyebrow">ABOUT</span><h1>${escapeHtml(s.about_title)}</h1><p class="lead">${escapeHtml(s.about_text)}</p><div class="prose">${textToSafeHtml(s.about_body_text)}</div></main>${siteFooterHtml(s)}${publicScript(s)}</body></html>`);
}

async function renderRssFeed(env, origin) {
  const s=await getSettings(env);const data=await getPublicHomeData(env,origin,{page:1});const items=(data.latest||[]).slice(0,30).map(x=>`<item><title>${escapeXml(x.title)}</title><link>${escapeXml(origin+x.url)}</link><guid isPermaLink="true">${escapeXml(origin+x.url)}</guid><pubDate>${new Date(Number(x.published_at)).toUTCString()}</pubDate><description>${escapeXml(x.excerpt)}</description></item>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(s.site_name)}</title><link>${escapeXml(origin)}</link><description>${escapeXml(s.site_description)}</description><language>zh-CN</language>${items}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'public, max-age=600',...securityHeaders()}});
}

async function renderSitemap(env, origin) {
  const [reports,articles]=await Promise.all([env.DB.prepare(`SELECT date_key AS slug,published_at FROM reports WHERE published=1 ORDER BY published_at DESC LIMIT 1000`).all(),env.DB.prepare(`SELECT slug,published_at FROM articles WHERE published=1 ORDER BY published_at DESC LIMIT 1000`).all()]);
  const fixed=['/','/archive','/category/free-nodes','/category/airports','/about'].map(p=>`<url><loc>${escapeXml(origin+p)}</loc></url>`).join('');
  const r=(reports.results||[]).map(x=>`<url><loc>${escapeXml(`${origin}/report/${encodeURIComponent(x.slug)}`)}</loc><lastmod>${new Date(Number(x.published_at)).toISOString()}</lastmod></url>`).join('');
  const a=(articles.results||[]).map(x=>`<url><loc>${escapeXml(`${origin}/article/${encodeURIComponent(x.slug)}`)}</loc><lastmod>${new Date(Number(x.published_at)).toISOString()}</lastmod></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${fixed}${r}${a}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600',...securityHeaders()}});
}

function siteHeaderHtml(settings, active = "") {
  const links = [
    [settings.nav_home_label, "/", "home"],
    [settings.nav_nodes_label, "/category/free-nodes", "免费节点"],
    [settings.nav_airport_label, "/category/airports", "机场推荐"],
    [settings.nav_archive_label, "/archive", "archive"],
    [settings.nav_about_label, "/about", "about"],
  ];
  return `<header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/">
        <span class="brand-mark">${siteLogoMark(settings)}</span>
        <span class="brand-copy"><b>${escapeHtml(settings.site_name)}</b><small>${escapeHtml(settings.site_subtitle)}</small></span>
      </a>
      <button class="menu-button" data-menu-toggle aria-label="打开菜单"><i></i><i></i><i></i></button>
      <nav data-main-nav>${links.map(([name, href, key]) => `<a class="${active === key ? "active" : ""}" href="${href}">${escapeHtml(name)}</a>`).join("")}</nav>
      <div class="header-tools">
        <a class="search-button" href="/?q=Clash" aria-label="${escapeHtml(settings.nav_search_label)}">⌕</a>
        <button class="theme-button" data-theme-toggle aria-label="切换主题">◐</button>
      </div>
    </div>
  </header>`;
}

function siteFooterHtml(settings) {
  return `<footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand">
        <a class="brand" href="/"><span class="brand-mark">${siteLogoMark(settings)}</span><span class="brand-copy"><b>${escapeHtml(settings.site_name)}</b><small>${escapeHtml(settings.site_subtitle)}</small></span></a>
        <p>${escapeHtml(settings.site_description)}</p>
      </div>
      <div><b>${escapeHtml(settings.footer_nav_title)}</b><a href="/category/free-nodes">${escapeHtml(settings.nav_nodes_label)}</a><a href="/category/airports">${escapeHtml(settings.nav_airport_label)}</a><a href="/archive">${escapeHtml(settings.nav_archive_label)}</a></div>
      <div><b>${escapeHtml(settings.footer_more_title)}</b><a href="/feed.xml">${escapeHtml(settings.footer_rss_label)}</a><a href="/about">${escapeHtml(settings.nav_about_label)}</a>${settings.telegram_url ? `<a href="${escapeHtml(settings.telegram_url)}" target="_blank" rel="noopener noreferrer">Telegram</a>` : ""}</div>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${escapeHtml(settings.site_name)}</span><span>${escapeHtml(settings.footer_text)}</span></div>
  </footer>`;
}

function paginationHtml(data, basePath, query = "") {const p=Number(data.page||1),t=Number(data.total_pages||1);if(t<=1)return '';const q=query?`&q=${encodeURIComponent(query)}`:'';return `<nav class="pagination">${p>1?`<a href="${basePath}?page=${p-1}${q}">← 上一页</a>`:'<span></span>'}<b>${p} / ${t}</b>${p<t?`<a href="${basePath}?page=${p+1}${q}">下一页 →</a>`:'<span></span>'}</nav>`;}

function publicScript(settings = DEFAULT_SETTINGS) {
  return `<script>(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem("cactus-theme");
    if (savedTheme) root.dataset.theme = savedTheme;
    const menu = document.querySelector("[data-menu-toggle]");
    const nav = document.querySelector("[data-main-nav]");
    menu && menu.addEventListener("click", () => nav && nav.classList.toggle("open"));
    document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      localStorage.setItem("cactus-theme", next);
    });
    document.querySelectorAll("[data-copy-url]").forEach((button) => button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        button.textContent = "已复制";
      } catch {}
    }));
    document.querySelectorAll("[data-copy-sub]").forEach((button) => button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copySub || "");
        button.textContent = "已复制";
        setTimeout(() => button.textContent = "复制链接", 1800);
      } catch {}
    }));
    const progress = document.querySelector("[data-reading-progress]");
    if (progress) {
      const update = () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        progress.style.transform = "scaleX(" + (max > 0 ? Math.min(1, scrollY / max) : 0) + ")";
      };
      addEventListener("scroll", update, { passive: true });
      update();
    }
  })();</script>`;
}


function adminHtml() {
  const textFields = [
    ["品牌与基础", [
      ["site_name","站点名称","input"],
      ["site_subtitle","Logo 下方副标题","input"],
      ["site_description","站点介绍 / SEO 描述","textarea"],
      ["site_notice","首页公告（留空隐藏）","textarea"],
      ["site_author","作者 / 品牌名","input"],
      ["seo_keywords","SEO 关键词","input"],
      ["site_logo_url","Logo 图片 URL（留空显示字母）","input"],
      ["site_logo_letter","Logo 字母","input"],
      ["theme_primary","主题强调色（#RRGGBB）","input"],
      ["theme_ink","标题与深色背景（#RRGGBB）","input"],
      ["theme_background","页面背景色（#RRGGBB）","input"],
      ["theme_radius","卡片圆角（8–36）","input"],
      ["about_title","关于页标题","input"],
      ["about_text","关于页简介","textarea"],
      ["about_body_text","关于页完整正文","textarea"],
      ["footer_text","页脚文案","textarea"],
      ["footer_nav_title","页脚导航标题","input"],
      ["footer_more_title","页脚更多标题","input"],
      ["footer_rss_label","RSS 链接文字","input"],
    ]],
    ["导航文字", [
      ["nav_home_label","首页","input"],
      ["nav_nodes_label","免费节点","input"],
      ["nav_airport_label","机场推荐","input"],
      ["nav_archive_label","文章归档","input"],
      ["nav_about_label","关于本站","input"],
      ["nav_search_label","顶部搜索","input"],
    ]],
    ["首页与列表", [
      ["hero_badge","无文章时首屏标签","input"],
      ["hero_title","无文章时首屏标题","input"],
      ["hero_highlight","无文章时高亮标题","input"],
      ["hero_description","无文章时首屏介绍","textarea"],
      ["hero_note","最新文章首屏补充说明","textarea"],
      ["hero_read_button","阅读全文按钮","input"],
      ["announcement_text","首页公告","textarea"],
      ["announcement_link_text","公告链接文字","input"],
      ["home_featured_label","首屏文章标签","input"],
      ["home_stats_title","首页数据栏标题","input"],
      ["home_stat_alive_label","数据栏：今日保留","input"],
      ["home_stat_sources_label","数据栏：节点来源","input"],
      ["home_stat_time_label","数据栏：最近更新","input"],
      ["home_stat_validity_label","数据栏：订阅有效","input"],
      ["home_read_more_text","文章卡片按钮","input"],
      ["home_view_all_text","查看全部按钮","input"],
      ["sidebar_status_title","侧栏状态标题","input"],
      ["sidebar_status_text","侧栏状态说明","textarea"],
      ["home_section_badge","文章区小标题","input"],
      ["home_section_title","文章区标题","input"],
      ["search_placeholder","搜索框提示","input"],
      ["search_button_text","搜索按钮","input"],
      ["empty_title","空列表标题","input"],
      ["empty_text","空列表说明","textarea"],
      ["sidebar_latest_title","侧栏最新文章标题","input"],
      ["sidebar_hot_title","侧栏热门内容标题","input"],
      ["sidebar_tags_title","侧栏标签标题","input"],
      ["telegram_cta","TG 按钮文字","input"],
      ["airport_sidebar_title","侧栏机场标题","input"],
      ["category_nodes_description","免费节点栏目说明","textarea"],
      ["category_airport_description","机场推荐栏目说明","textarea"],
    ]],
    ["文章与订阅", [
      ["subscription_kicker","订阅区小标题","input"],
      ["subscription_title","订阅区标题","input"],
      ["subscription_description","订阅区说明","textarea"],
      ["subscription_expiry_label","有效期标签","input"],
      ["subscription_expired_title","过期标题","input"],
      ["subscription_expired_text","过期说明","textarea"],
      ["subscription_latest_cta","过期后返回按钮","input"],
      ["subscription_copy_text","复制订阅按钮","input"],
      ["clash_button_text","Clash 按钮文字","input"],
      ["v2ray_button_text","V2Ray 按钮文字","input"],
      ["article_note_title","文章提醒标题","input"],
      ["article_note_text","文章提醒正文","textarea"],
      ["read_count_suffix","阅读量后缀","input"],
      ["copy_link_text","复制链接按钮","input"],
      ["article_prev_label","上一篇文字","input"],
      ["article_next_label","下一篇文字","input"],
      ["article_back_label","返回列表文字","input"],
      ["report_stat_fetched_label","日报统计：抓取","input"],
      ["report_stat_unique_label","日报统计：去重后","input"],
      ["report_stat_alive_label","日报统计：保留","input"],
      ["report_stat_dead_label","日报统计：剔除","input"],
      ["report_title_template","自动日报标题模板","textarea"],
      ["report_excerpt_template","自动日报摘要模板","textarea"],
      ["report_body_template","自动日报正文模板","textarea"],
    ]],
    ["Telegram 与机场", [
      ["telegram_name","TG 名称","input"],
      ["telegram_url","TG 链接","input"],
      ["telegram_description","TG 介绍","textarea"],
      ["airport_name","机场名称","input"],
      ["airport_url","机场链接","input"],
      ["airport_badge","机场标签","input"],
      ["airport_cta","机场按钮","input"],
      ["airport_description","机场宣传文案","textarea"],
    ]],
    ["常见问题", [
      ["faq_section_badge","FAQ 小标题","input"],
      ["faq_section_title","FAQ 大标题","input"],
      ["faq_1_q","问题 1","input"],["faq_1_a","回答 1","textarea"],
      ["faq_2_q","问题 2","input"],["faq_2_a","回答 2","textarea"],
      ["faq_3_q","问题 3","input"],["faq_3_a","回答 3","textarea"],
    ]],
  ];
  const textSettingsHtml = textFields.map(([title, fields]) => `<section class="settings-group"><h3>${title}</h3><div class="grid">${fields.map(([key,label,type])=>`<div class="field ${type==='textarea'?'full':''}"><label>${label}<small>${key}</small></label>${type==='textarea'?`<textarea id="${key}"></textarea>`:`<input id="${key}">`}</div>`).join("")}</div></section>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cactus 管理后台</title>${sharedStyles()}<style>
  body{background:#f3f6fb;color:#172033}.global-progress{position:fixed;z-index:200;left:0;right:0;top:0;height:3px;overflow:hidden;background:transparent}.global-progress i{display:block;width:36%;height:100%;background:linear-gradient(90deg,#2563eb,#06b6d4);animation:admin-progress 1.05s ease-in-out infinite}.global-progress.hidden{display:none}@keyframes admin-progress{0%{transform:translateX(-120%)}100%{transform:translateX(380%)}}
  .network-banner{position:fixed;z-index:190;left:50%;top:12px;transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:#991b1b;color:#fff;font-size:12px;box-shadow:0 10px 30px #0003}.admin-login{min-height:100vh;display:grid;place-items:center;padding:24px}.login-panel{width:min(430px,100%);background:#fff;border:1px solid #e3e7ed;border-radius:20px;padding:32px;box-shadow:0 20px 60px #17203312}.login-panel h1{margin:0 0 7px}.login-panel>p{color:#6b7280;margin:0 0 22px}.login-hint{min-height:20px;margin:12px 0 0!important;font-size:12px}.login-hint.error{color:#b42318}.admin-app{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:100vh}.admin-side{background:linear-gradient(180deg,#111827,#17233a);color:#fff;padding:22px 16px;position:sticky;top:0;height:100vh}.admin-side h2{margin:0 8px 22px}.admin-side nav{display:grid;gap:5px}.admin-side button,.admin-side a{border:0;background:transparent;color:#aeb8c9;padding:11px 12px;border-radius:9px;text-align:left;cursor:pointer;font:inherit}.admin-side button.active,.admin-side button:hover{background:#29364d;color:#fff}.admin-side footer{position:absolute;bottom:20px;left:16px;right:16px;display:grid;gap:7px}.admin-main{padding:28px;min-width:0}.admin-head{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:20px;position:sticky;top:0;z-index:20;background:rgba(243,246,251,.92);backdrop-filter:blur(12px);padding:13px 0}.admin-head h1{margin:0}.admin-head p{margin:3px 0;color:#7d8796}.admin-head-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap}.sync-state,.unsaved-state{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 9px;font-size:11px;background:#fff;border:1px solid #dfe5ed;color:#667085}.sync-state:before{content:"";width:7px;height:7px;border-radius:50%;background:#94a3b8}.sync-state[data-state="syncing"]:before{background:#2563eb;box-shadow:0 0 0 4px #dbeafe}.sync-state[data-state="ok"]:before{background:#16a34a}.sync-state[data-state="error"]:before{background:#dc2626}.unsaved-state{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.admin-view{display:none}.admin-view.active{display:block}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat{background:#fff;border:1px solid #e2e5ea;border-radius:14px;padding:18px}.stat span{color:#7b8492;font-size:12px}.stat b{display:block;font-size:28px}.panel{background:#fff;border:1px solid #e2e5ea;border-radius:15px;padding:20px;margin-top:16px;box-shadow:0 8px 24px rgba(15,23,42,.025)}.panel-head{display:flex;justify-content:space-between;gap:15px;align-items:center;margin-bottom:14px}.panel-head h2,.panel-head p{margin:0}.panel-head p{color:#77818f;font-size:12px}.btn{position:relative;border:1px solid #d8dde5;background:#fff;padding:9px 12px;border-radius:9px;font-weight:700;cursor:pointer;transition:.15s;min-height:38px}.btn:hover:not(:disabled){transform:translateY(-1px);border-color:#b9c4d4}.btn:active:not(:disabled){transform:translateY(0)}.btn:disabled{opacity:.56;cursor:not-allowed}.btn.primary{background:var(--brand);color:#fff;border-color:var(--brand)}.btn.danger{color:#c33}.btn.small{padding:6px 9px;font-size:12px;min-height:31px}.btn.is-loading{color:transparent!important;pointer-events:none}.btn.is-loading:after{content:"";position:absolute;width:15px;height:15px;left:50%;top:50%;margin:-8px 0 0 -8px;border:2px solid currentColor;border-color:#94a3b8 #94a3b8 #94a3b8 transparent;border-radius:50%;animation:spin .7s linear infinite}.btn.primary.is-loading:after{border-color:#fff #fff #fff transparent}@keyframes spin{to{transform:rotate(360deg)}}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:grid;gap:6px}.field.full{grid-column:1/-1}.field label{font-size:12px;color:#4f5a69;font-weight:650}.field label small{display:block;color:#a0a8b4;font-weight:400}input,textarea,select{width:100%;padding:10px 11px;border:1px solid #d8dde5;border-radius:9px;font:inherit;background:#fff;color:#172033;transition:.15s}input:focus,textarea:focus,select:focus{outline:0;border-color:#7aa7f8;box-shadow:0 0 0 3px #dbeafe}textarea{min-height:110px;resize:vertical}.list{display:grid}.row{display:flex;justify-content:space-between;gap:15px;padding:15px 0;border-top:1px solid #edf0f3;transition:.2s}.row:first-child{border-top:0}.row.is-busy{opacity:.68}.row h3{margin:0 0 4px;font-size:15px}.row p{margin:0;color:#77818f;font-size:12px;word-break:break-all}.row .error{color:#c84545}.actions{display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start}.pill{display:inline-block;padding:3px 7px;border-radius:999px;background:#edf1f7;font-size:10px}.pill.live{background:#e5f6ee;color:#187452}.pill.warn{background:#fff0dd;color:#996000}.pill.running{background:#dbeafe;color:#1d4ed8}.modal{position:fixed;inset:0;background:#0009;display:grid;place-items:center;padding:18px;z-index:80}.modal-card{width:min(820px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 28px 80px #0004}.confirm-card{width:min(440px,100%)}.confirm-card h2{margin:0 0 8px}.confirm-card p{color:#667085;line-height:1.65}.hidden{display:none!important}.toast-stack{position:fixed;z-index:210;right:18px;bottom:18px;width:min(370px,calc(100% - 36px));display:grid;gap:9px}.toast-card{background:#172033;color:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 18px 45px #0003;display:grid;grid-template-columns:8px 1fr auto;gap:10px;align-items:start;animation:toast-in .2s ease}.toast-card:before{content:"";width:8px;height:8px;border-radius:50%;margin-top:5px;background:#60a5fa}.toast-card.success:before{background:#4ade80}.toast-card.error:before{background:#fb7185}.toast-card.warning:before{background:#fbbf24}.toast-card p{margin:0;font-size:13px;line-height:1.45}.toast-card button{border:0;background:transparent;color:#cbd5e1;cursor:pointer}@keyframes toast-in{from{opacity:0;transform:translateY(8px)}}.settings-group{border-top:1px solid #edf0f3;padding:20px 0}.settings-group:first-child{border-top:0;padding-top:0}.settings-group h3{margin:0 0 14px}.sub-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:9px}.sub-row input{font-family:monospace;font-size:12px}.help{padding:12px;border-radius:10px;background:#fff8ea;color:#765a24;font-size:12px;margin-bottom:15px}.progress{height:8px;background:#edf1f6;border-radius:99px;overflow:hidden;margin-top:9px;position:relative}.progress i{display:block;height:100%;background:linear-gradient(90deg,var(--brand),#06b6d4);transition:width .35s}.progress.indeterminate i{width:38%!important;animation:indeterminate 1.2s ease-in-out infinite}@keyframes indeterminate{0%{transform:translateX(-110%)}100%{transform:translateX(300%)}}.template-tip{font-size:12px;color:#687485;background:#f4f7fb;border-radius:9px;padding:10px;margin-bottom:16px}.protocol-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.protocol-item{border:1px solid #e2e5ea;border-radius:12px;padding:13px;background:#fafbfc}.protocol-item b,.protocol-item span,.protocol-item small{display:block}.protocol-item b{font-size:14px;text-transform:uppercase}.protocol-item span{font-size:22px;font-weight:850}.protocol-item small{color:#7d8796}.preview-box{padding:13px;border:1px dashed #cdd4df;border-radius:10px;background:#f7f9fc}.preview-box b{display:block;margin-bottom:5px}.preview-box p{margin:4px 0;color:#667085}.active-task{border-color:#bfdbfe;background:linear-gradient(135deg,#fff,#f4f8ff)}.active-task-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.active-task-head h2{margin:0}.active-task-head p{margin:4px 0 0;color:#667085;font-size:12px}.active-task-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:15px}.active-task-grid div{background:#fff;border:1px solid #dbe5f3;border-radius:10px;padding:10px}.active-task-grid small,.active-task-grid b{display:block}.active-task-grid small{font-size:10px;color:#7b8492}.active-task-grid b{font-size:18px}.form-actions{position:sticky;bottom:12px;z-index:8;margin-top:20px;padding:11px;border:1px solid #dbe3ee;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.form-actions span{font-size:11px;color:#7b8492}.task-auto-note{font-size:12px;color:var(--muted)}.source-quality{margin-top:10px;padding:10px 12px;border:1px solid #dbeafe;background:#f8fbff;border-radius:12px}.source-quality p{margin:3px 0;font-size:12px;line-height:1.65}.source-quality strong{color:#1663d7}.source-quality-warn{border-color:#fecaca;background:#fff7f7}.source-quality-warn b{color:#c93030}.source-row>div:first-child{min-width:0;flex:1}.empty-state{padding:24px;text-align:center;color:#7b8492}.modal-close{float:right}.admin-side{background:linear-gradient(180deg,#121826,#1d2636)}
  @media(max-width:1000px){.stats{grid-template-columns:repeat(3,1fr)}.active-task-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:850px){.admin-app{display:block}.admin-side{position:static;height:auto}.admin-side nav{display:flex;overflow:auto}.admin-side nav button{white-space:nowrap}.admin-side footer{display:none}.admin-main{padding:14px}.admin-head{top:0}.stats{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}.field.full{grid-column:auto}.row{display:grid}.active-task-grid{grid-template-columns:1fr 1fr}.admin-head-actions{justify-content:flex-start}.sync-state{display:none}}@media(max-width:520px){.stats{grid-template-columns:1fr 1fr}.stat b{font-size:22px}.panel{padding:15px}.active-task-grid{grid-template-columns:1fr 1fr}.form-actions{bottom:7px}.toast-stack{right:10px;bottom:10px;width:calc(100% - 20px)}}
  </style></head><body><div id="globalProgress" class="global-progress hidden"><i></i></div><div id="networkBanner" class="network-banner hidden">网络已断开，请等待网络恢复后再操作。</div><div id="login" class="admin-login"><form id="loginForm" class="login-panel"><h1>管理后台</h1><p>节点源、日报、文章和前台文案都在这里管理。</p><div class="field"><label>管理员密码</label><input id="password" type="password" autocomplete="current-password" required></div><br><button id="loginButton" class="btn primary" type="submit">登录</button><p id="loginHint" class="login-hint"></p></form></div><div id="app" class="admin-app hidden"><aside class="admin-side"><h2>Cactus Admin</h2><nav><button class="active" data-tab="dashboard">概览</button><button data-tab="sources">节点源</button><button data-tab="reports">自动日报</button><button data-tab="articles">内容文章</button><button data-tab="tasks">任务记录</button><button data-tab="copy">前台文案</button><button data-tab="system">系统设置</button></nav><footer><a href="/" target="_blank">打开博客</a><button id="logout">退出登录</button></footer></aside><main class="admin-main"><header class="admin-head"><div><h1 id="title">概览</h1><p id="sub">查看网站和任务状态</p></div><div class="admin-head-actions"><span id="unsavedIndicator" class="unsaved-state hidden">有未保存修改</span><span id="syncState" class="sync-state" data-state="idle">尚未同步</span><button id="refresh" class="btn">刷新</button></div></header>
  <section class="admin-view active" data-view="dashboard"><div id="stats" class="stats"></div><section id="activeTaskPanel" class="panel active-task hidden"></section><section class="panel"><div class="panel-head"><h2>快速操作</h2></div><div class="actions"><button id="startRun" class="btn primary">立即测活</button><button id="newArticleQuick" class="btn">发布文章</button><a class="btn" href="/" target="_blank">查看首页</a><button id="downloadBackup" class="btn">导出完整备份</button></div></section><section class="panel"><div class="panel-head"><div><h2>协议分布</h2><p>查看节点池中各协议数量与最近一次存活数量。</p></div></div><div id="protocolStats" class="protocol-grid"></div></section><section class="panel"><div class="panel-head"><div><h2>最新文章订阅</h2><p>这里只显示后台自用地址；公开首页仍不会出现。</p></div></div><div id="subs"></div></section></section>
  <section class="admin-view" data-view="sources"><section class="panel"><div class="panel-head"><div><h2>节点源</h2><p>名称和地址只在后台出现，公开节点名会统一重写。</p></div><button id="resetSourceBtn" class="btn">清空表单</button></div><form id="sourceForm" class="grid"><input id="sourceId" type="hidden"><div class="field"><label>内部名称</label><input id="sourceName" required></div><div class="field"><label>类型</label><select id="sourceKind"><option value="url">订阅地址</option><option value="text">节点文本</option></select></div><div class="field"><label>状态</label><label><input id="sourceEnabled" type="checkbox" checked style="width:auto"> 启用这个源</label></div><div class="field"><label>节点类型</label><select id="sourceNodeClass"><option value="auto">自动识别</option><option value="direct">普通直连节点</option><option value="cf_native">CF Worker / Pages 原生节点</option><option value="cf_cdn">套 Cloudflare CDN 的回源节点</option><option value="unknown">无法确定</option></select></div><div class="field"><label>可信 CF 历史保护</label><label><input id="sourceTrustedCf" type="checkbox" style="width:auto"> 成功验证过一次后，短期失败不立刻移出订阅</label></div><div class="field"><label>白名单直入</label><label><input id="sourceRandomWhitelist" type="checkbox" style="width:auto"> 每次拉取后跳过网络测活，纯随机抽取 1/3 直接进入订阅</label></div><div class="field full"><label>地址或内容</label><textarea id="sourceContent" required style="min-height:190px"></textarea></div><div class="actions"><button id="saveSourceButton" class="btn primary" type="submit">保存节点源</button><button id="previewSource" type="button" class="btn">解析预览</button></div><div id="sourcePreview" class="field full preview-box hidden"></div></form><div id="sourceList" class="list"></div></section><section class="panel"><div class="panel-head"><div><h2>批量导入订阅</h2><p>每行一个地址；也可以写成“名称|订阅地址”。已存在的地址会自动跳过。</p></div></div><textarea id="bulkSources" style="min-height:180px" placeholder="来源 A|https://example.com/sub&#10;https://example.net/sub"></textarea><br><br><button id="importSources" class="btn primary">批量导入</button></section></section>
  <section class="admin-view" data-view="reports"><section class="panel"><div class="panel-head"><div><h2>自动日报</h2><p>可编辑标题、摘要、封面、SEO、正文、公开状态和置顶。</p></div></div><div id="reportList" class="list"></div></section></section>
  <section class="admin-view" data-view="articles"><section class="panel"><div class="panel-head"><div><h2>内容文章</h2><p>每篇公开文章都必须关联一篇仍有效的日报订阅。</p></div><button id="newArticleBtn" class="btn primary">写文章</button></div><div id="articleList" class="list"></div></section></section>
  <section class="admin-view" data-view="tasks"><section class="panel"><div class="panel-head"><div><h2>任务记录</h2><p>运行中的任务会自动刷新，不用反复点击按钮确认。</p><span id="taskRefreshState" class="task-auto-note"></span></div><button id="startRun2" class="btn primary">立即测活</button></div><div id="runList" class="list"></div></section></section>
  <section class="admin-view" data-view="copy"><section class="panel"><div class="panel-head"><div><h2>前台文案</h2><p>首页、文章、订阅区、机场、TG、FAQ 都可以修改。</p></div></div><div class="template-tip">日报模板变量：{{date}}、{{sources}}、{{fetched}}、{{unique}}、{{config}}、{{transport}}、{{verified}}、{{trusted}}、{{unknown}}、{{alive}}、{{dead}}。正文支持“## 标题”和“- 列表”。</div><form id="copyForm">${textSettingsHtml}<div class="form-actions"><span>修改后点击保存，自动刷新不会覆盖尚未保存的内容。</span><button id="saveCopyButton" class="btn primary" type="submit">保存全部文案</button></div></form></section></section>
  <section class="admin-view" data-view="system"><section class="panel"><div class="panel-head"><div><h2>系统设置</h2><p>普通节点先做 2 秒快筛，疑似节点再复检。VLESS、Trojan、SOCKS5、HTTP 和常见 AES-GCM Shadowsocks 会真正通过候选节点访问固定随机回显接口；不允许直连兜底或切换其他节点。白名单直入源仍完全跳过网络测活。</p></div></div><form id="systemForm" class="grid"><div class="field"><label>每天测活时间（东八区）<small>daily_test_time</small></label><input id="daily_test_time"></div><div class="field"><label>测活完成后几分钟发布<small>report_delay_minutes</small></label><input id="report_delay_minutes" type="number" min="1" max="1440"></div><div class="field"><label>每页文章数<small>posts_per_page</small></label><input id="posts_per_page" type="number" min="4" max="20"></div><div class="field"><label>文章订阅有效天数<small>subscription_valid_days</small></label><input id="subscription_valid_days" type="number" min="1" max="30"></div><div class="field"><label>节点源抓取并发<small>source_fetch_concurrency</small></label><input id="source_fetch_concurrency" type="number" min="1" max="10"></div><div class="field"><label>节点源抓取超时（毫秒）<small>source_timeout_ms</small></label><input id="source_timeout_ms" type="number" min="5000" max="120000"></div><div class="field"><label>每条 Queue 消息节点数<small>health_message_nodes</small></label><input id="health_message_nodes" type="number" min="5" max="25"></div><div class="field"><label>单次测活并发<small>health_concurrency</small></label><input id="health_concurrency" type="number" min="1" max="5"></div><div class="field"><label>快速检查超时（毫秒）<small>health_timeout_ms；默认 2000</small></label><input id="health_timeout_ms" type="number" min="1000" max="10000" step="500"></div><div class="field"><label>疑似可用节点复检超时（毫秒）<small>health_recheck_timeout_ms；默认 8000</small></label><input id="health_recheck_timeout_ms" type="number" min="2000" max="15000" step="500"></div><div class="field"><label>可信 CF 成功状态保留天数<small>trusted_cf_success_days</small></label><input id="trusted_cf_success_days" type="number" min="1" max="30"></div><div class="field"><label>可信 CF 连续失败移除次数<small>trusted_cf_failure_limit</small></label><input id="trusted_cf_failure_limit" type="number" min="2" max="10"></div><div class="field"><label>订阅纳入等级<small>health_quality_mode</small></label><select id="health_quality_mode"><option value="verified_only">严格：只收真实代理验证</option><option value="verified_and_transport">平衡：真实验证 + 传输通过</option><option value="all_nonfailed">宽松：再加入 CF 无法判断</option></select></div><div class="field"><label>低质量判断次数<small>source_low_quality_runs</small></label><input id="source_low_quality_runs" type="number" min="3" max="20"></div><div class="field"><label>每次真实验证不高于多少算低质量<small>source_low_quality_verified_max</small></label><input id="source_low_quality_verified_max" type="number" min="0" max="1000"></div><label><input id="source_auto_disable" type="checkbox" style="width:auto"> 连续低质量且无独占贡献时自动停用节点源</label><div class="field"><label>单份订阅最大节点数<small>subscription_max_nodes；0 表示不限制</small></label><input id="subscription_max_nodes" type="number" min="0" max="100000"></div><div class="field"><label>订阅节点排序<small>subscription_shuffle</small></label><select id="subscription_shuffle"><option value="0">保持稳定顺序</option><option value="1">按节点指纹打散</option></select></div><div class="field"><label>Clash 策略组名称<small>subscription_group_name</small></label><input id="subscription_group_name"></div><div class="field"><label>节点名称前缀<small>node_name_prefix</small></label><input id="node_name_prefix"></div><div class="field full"><label>节点名称模板<small>node_name_template；可用 {{country}} {{prefix}} {{index}} {{host}}；不会公开节点源名称</small></label><input id="node_name_template"></div><label><input id="auto_publish" type="checkbox" style="width:auto"> 测活完成后自动发布日报</label><div class="field full form-actions"><span>修改后点击保存，运行中的任务不会被打断。</span><button id="saveSystemButton" class="btn primary" type="submit">保存系统设置</button></div></form></section></section></main></div>
  <div id="reportModal" class="modal hidden"><form id="reportForm" class="modal-card"><button type="button" class="btn small modal-close" data-close-modal="reportModal">关闭</button><h2>编辑自动日报</h2><input id="reportId" type="hidden"><div class="grid"><div class="field full"><label>标题</label><input id="reportTitle" required></div><div class="field full"><label>摘要</label><textarea id="reportExcerpt"></textarea></div><div class="field full"><label>封面图片 URL</label><input id="reportCover"></div><div class="field"><label>SEO 标题</label><input id="reportSeoTitle"></div><div class="field"><label>SEO 描述</label><input id="reportSeoDescription"></div><div class="field full"><label>正文（支持 ## 标题、- 列表）</label><textarea id="reportBody" required style="min-height:320px"></textarea></div><label><input id="reportPublished" type="checkbox" style="width:auto"> 公开发布</label><label><input id="reportPinned" type="checkbox" style="width:auto"> 首页置顶</label></div><br><div class="actions"><button id="saveReportButton" class="btn primary" type="submit">保存日报</button><button type="button" class="btn" data-close-modal="reportModal">取消</button><button type="button" id="deleteReportButton" class="btn danger">删除</button></div></form></div>
  <div id="articleModal" class="modal hidden"><form id="articleForm" class="modal-card"><button type="button" class="btn small modal-close" data-close-modal="articleModal">关闭</button><h2>编辑内容文章</h2><input id="articleId" type="hidden"><div class="grid"><div class="field full"><label>标题</label><input id="articleTitle" required></div><div class="field"><label>链接别名（英文，可留空）</label><input id="articleSlug"></div><div class="field"><label>分类</label><select id="articleCategory"><option>免费节点</option><option>机场推荐</option></select></div><div class="field full"><label>摘要</label><textarea id="articleExcerpt"></textarea></div><div class="field full"><label>封面图片 URL</label><input id="articleCover"></div><div class="field"><label>SEO 标题</label><input id="articleSeoTitle"></div><div class="field"><label>SEO 描述</label><input id="articleSeoDescription"></div><div class="field full"><label>标签（逗号分隔）</label><input id="articleTags" placeholder="Clash, V2Ray, 4K, 机场"></div><div class="field full"><label>关联订阅日报</label><select id="articleRun" required></select></div><div class="field full"><label>正文（## 标题，- 列表）</label><textarea id="articleBody" required style="min-height:320px"></textarea></div><label><input id="articlePublished" type="checkbox" style="width:auto"> 公开发布</label><label><input id="articlePinned" type="checkbox" style="width:auto"> 首页置顶</label></div><br><div class="actions"><button id="saveArticleButton" class="btn primary" type="submit">保存文章</button><button type="button" class="btn" data-close-modal="articleModal">取消</button><button type="button" id="deleteArticle" class="btn danger">删除</button></div></form></div>
  <div id="confirmModal" class="modal hidden"><div class="modal-card confirm-card"><h2 id="confirmTitle">确认操作</h2><p id="confirmMessage"></p><div class="actions"><button id="confirmAccept" class="btn danger">确认</button><button id="confirmCancel" class="btn">取消</button></div></div></div><div id="toastStack" class="toast-stack" aria-live="polite"></div>
  <script>
  const $=function(s){return document.querySelector(s)};const $$=function(s){return Array.from(document.querySelectorAll(s))};const el=function(id){return document.getElementById(id)};let state=null;let activeTab='dashboard';let loadPromise=null;let pollTimer=null;let confirmResolver=null;let progressCount=0;const dirtyForms=new Set();const actionLocks=new Set();
  const COPY_KEYS=${JSON.stringify(textFields.flatMap(([,fields])=>fields.map(([key])=>key)))};
  const SYSTEM_KEYS=['daily_test_time','report_delay_minutes','posts_per_page','subscription_valid_days','source_fetch_concurrency','source_timeout_ms','health_message_nodes','health_concurrency','health_timeout_ms','health_recheck_timeout_ms','health_quality_mode','trusted_cf_success_days','trusted_cf_failure_limit','source_low_quality_runs','source_low_quality_verified_max','subscription_max_nodes','subscription_shuffle','subscription_group_name','node_name_prefix','node_name_template'];
  const ACTIVE_STATUSES=['preparing','testing','paused_preparing','paused_testing'];const POLL_STATUSES=['preparing','testing','completed'];
  const STATUS_TEXT={preparing:'正在抓取节点',testing:'正在逐条测活',paused_preparing:'已暂停抓取',paused_testing:'已暂停测活',completed:'测活完成，等待发布',published:'已发布',hidden:'已隐藏',error:'任务异常',deleted:'文章已删除',discarded:'已移除'};
  const esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})};
  function formatClock(value){const d=new Date(Number(value||Date.now()));return d.toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}
  function fmt(v){return v?new Date(Number(v)).toLocaleString('zh-CN',{hour12:false}):'—'}
  function setSync(mode,text){const node=el('syncState');node.dataset.state=mode;node.textContent=text}
  function showProgress(show){progressCount=Math.max(0,progressCount+(show?1:-1));el('globalProgress').classList.toggle('hidden',progressCount===0)}
  function notify(message,type,options){type=type||'info';options=options||{};const card=document.createElement('div');card.className='toast-card '+type;const p=document.createElement('p');p.textContent=String(message||'');const close=document.createElement('button');close.type='button';close.textContent='×';close.onclick=function(){card.remove()};card.append(p,close);el('toastStack').appendChild(card);const duration=options.persistent?0:Number(options.duration||(type==='error'?7000:3600));if(duration)setTimeout(function(){card.remove()},duration);return card}
  function setButtonBusy(button,busy,label){if(!button)return;if(busy){if(button.dataset.busy==='1')return false;button.dataset.busy='1';button.dataset.originalText=button.textContent;button.classList.add('is-loading');button.disabled=true;if(label)button.setAttribute('aria-label',label)}else{button.dataset.busy='0';button.classList.remove('is-loading');button.disabled=false;if(button.dataset.originalText!=null)button.textContent=button.dataset.originalText;button.removeAttribute('aria-label')}return true}
  async function api(path,options,meta){options=options||{};meta=meta||{};const controller=new AbortController();const timeout=setTimeout(function(){controller.abort()},Number(meta.timeout||45000));const headers=new Headers(options.headers||{});if(options.body!=null&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');try{const response=await fetch(path,Object.assign({credentials:'same-origin',signal:controller.signal},options,{headers:headers}));const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={message:raw}}if(!response.ok){const error=new Error(data.error||data.message||('请求失败（'+response.status+'）'));error.status=response.status;throw error}return data}catch(error){if(error&&error.name==='AbortError')throw new Error('请求超时，请检查网络后重试');throw error}finally{clearTimeout(timeout)}}
  async function performAction(button,key,labels,work){if(actionLocks.has(key))return null;actionLocks.add(key);setButtonBusy(button,true,labels.loading);const row=button&&button.closest('.row');if(row)row.classList.add('is-busy');showProgress(true);try{const result=await work();if(labels.success)notify(typeof labels.success==='function'?labels.success(result):labels.success,'success');return result}catch(error){notify((labels.errorPrefix||'操作失败：')+error.message,'error',{persistent:false});throw error}finally{actionLocks.delete(key);setButtonBusy(button,false);if(row)row.classList.remove('is-busy');showProgress(false)}}
  function askConfirm(title,message,confirmText,danger){el('confirmTitle').textContent=title||'确认操作';el('confirmMessage').textContent=message||'';el('confirmAccept').textContent=confirmText||'确认';el('confirmAccept').className='btn '+(danger===false?'primary':'danger');el('confirmModal').classList.remove('hidden');return new Promise(function(resolve){confirmResolver=resolve})}
  function finishConfirm(value){el('confirmModal').classList.add('hidden');if(confirmResolver){const resolve=confirmResolver;confirmResolver=null;resolve(value)}}
  function updateDirtyIndicator(){el('unsavedIndicator').classList.toggle('hidden',dirtyForms.size===0)}
  function markDirty(form){if(!form||!form.id)return;dirtyForms.add(form.id);updateDirtyIndicator()}
  function clearDirty(form){if(!form)return;dirtyForms.delete(typeof form==='string'?form:form.id);updateDirtyIndicator()}
  function formSnapshot(form){return Array.from(form.elements).filter(function(x){return x.name!==undefined||x.id}).map(function(x){return x.type==='checkbox'?(x.id+':'+x.checked):(x.id+':'+x.value)}).join('|')}
  function openModal(id){const modal=el(id);modal.classList.remove('hidden');const form=modal.querySelector('form');if(form)form.dataset.snapshot=formSnapshot(form)}
  async function requestCloseModal(id,force){const modal=el(id);const form=modal.querySelector('form');if(!force&&form&&form.dataset.snapshot&&form.dataset.snapshot!==formSnapshot(form)){const ok=await askConfirm('放弃未保存修改？','关闭后，本次修改不会保留。','放弃修改',true);if(!ok)return}modal.classList.add('hidden')}
  function go(name){activeTab=name;$$('[data-tab]').forEach(function(x){x.classList.toggle('active',x.dataset.tab===name)});$$('[data-view]').forEach(function(x){x.classList.toggle('active',x.dataset.view===name)});const titles={dashboard:['概览','查看网站和任务状态'],sources:['节点源','管理私有节点池'],reports:['自动日报','编辑每日自动生成的文章'],articles:['内容文章','发布和管理普通文章'],tasks:['任务记录','实时查看抓取、测活和发布进度'],copy:['前台文案','修改博客中的全部文字'],system:['系统设置','管理测活、订阅和节点名称']};el('title').textContent=titles[name][0];el('sub').textContent=titles[name][1];schedulePoll()}
  function resetSource(){el('sourceForm').reset();el('sourceId').value='';el('sourceEnabled').checked=true;el('sourceNodeClass').value='auto';el('sourceTrustedCf').checked=false;el('sourceRandomWhitelist').checked=false;el('sourcePreview').classList.add('hidden');el('sourcePreview').innerHTML='';el('saveSourceButton').textContent='保存节点源'}
  function runOptions(selected){const days=Number(state.settings.subscription_valid_days||5);const cutoff=Date.now()-days*86400000;const rows=state.reports.filter(function(r){return r.published&&Number(r.published_at||0)>cutoff});return rows.map(function(r){return '<option value="'+r.run_id+'" '+(Number(selected)===Number(r.run_id)?'selected':'')+'>'+esc(r.date_key)+' · '+esc(r.title)+'</option>'}).join('')}
  function currentActiveRun(){return state&&state.runs.find(function(r){return ACTIVE_STATUSES.includes(r.status)})}
  function currentPollingRun(){return state&&state.runs.find(function(r){return POLL_STATUSES.includes(r.status)})}
  function runProgress(run){const total=Number(run.total_unique||0);const tested=Number(run.tested||0);return total?Math.min(100,Math.round(tested/total*100)):0}
  function renderActiveTask(){const run=currentPollingRun()||currentActiveRun();const panel=el('activeTaskPanel');if(!run){panel.classList.add('hidden');panel.innerHTML='';return}const total=Number(run.total_unique||0);const tested=Number(run.tested||0);const pct=runProgress(run);const indeterminate=run.status==='preparing'&&total===0;panel.innerHTML='<div class="active-task-head"><div><h2>'+esc(STATUS_TEXT[run.status]||run.status)+'</h2><p>'+esc(run.date_key)+' · 任务 #'+run.id+' · 页面会自动刷新</p></div><button class="btn small" data-action="go-tasks">查看任务详情</button></div><div class="active-task-grid"><div><small>抓取</small><b>'+Number(run.total_fetched||0)+'</b></div><div><small>去重</small><b>'+total+'</b></div><div><small>已测</small><b>'+tested+'</b></div><div><small>配置通过</small><b>'+Number(run.config_pass||0)+'</b></div><div><small>传输通过</small><b>'+Number(run.transport_pass||0)+'</b></div><div><small>真实验证</small><b>'+Number(run.verified||0)+'</b></div><div><small>白名单保留</small><b>'+Number(run.trusted_retained||0)+'</b></div><div><small>进入订阅</small><b>'+Number(run.alive||0)+'</b></div><div><small>CF待判</small><b>'+Number(run.cf_unknown||0)+'</b></div></div><div class="progress '+(indeterminate?'indeterminate':'')+'"><i style="width:'+pct+'%"></i></div>';panel.classList.remove('hidden')}
  function sourceStatsFor(id){return (state.source_stats||[]).filter(function(x){return Number(x.source_id)===Number(id)}).sort(function(a,b){return Number(b.run_id)-Number(a.run_id)})}
  function sourceClassLabel(value){return ({auto:'自动识别',direct:'普通直连',cf_native:'CF 原生',cf_cdn:'CF CDN 回源',unknown:'无法确定'})[String(value||'auto')]||'自动识别'}
  function sourceQualityHtml(source){const rows=sourceStatsFor(source.id);if(!rows.length)return '<p class="muted">还没有完成过任务</p>';const latest=rows[0];const recent=rows.slice(0,7);const avg=function(key){return (recent.reduce(function(sum,x){return sum+Number(x[key]||0)},0)/recent.length).toFixed(1)};if(source.random_whitelist){return '<div class="source-quality"><p><b>最近一次：</b>抓取 '+latest.fetched_count+' · 去重贡献 '+latest.unique_count+' · <strong>纯随机直入 '+Number(latest.whitelist_selected_count||0)+'</strong> · 本轮未抽中 '+Number(latest.whitelist_skipped_count||0)+' · 最终入订阅 '+latest.included_count+' · 独占 '+latest.exclusive_count+'</p><p>这个源跳过网络测活；每次任务都会重新纯随机抽取约 1/3，不保证与上一次相同。</p></div>'}let streak=0;for(const row of rows){if(Number(row.verified_count||0)+Number(row.trusted_retained_count||0)<=Number(state.settings.source_low_quality_verified_max||1)&&Number(row.exclusive_count||0)===0)streak++;else break}const dup=Number(latest.fetched_count||0)>0?Math.max(0,100-Number(latest.unique_count||0)/Number(latest.fetched_count||0)*100):0;const overlap=Number(latest.included_count||0)>0?Math.max(0,100-Number(latest.exclusive_count||0)/Number(latest.included_count||0)*100):0;const warn=!source.trusted_cf&&!source.random_whitelist&&streak>=Number(state.settings.source_low_quality_runs||5);return '<div class="source-quality '+(warn?'source-quality-warn':'')+'"><p><b>最近一次：</b>抓取 '+latest.fetched_count+' · 去重贡献 '+latest.unique_count+' · 配置 '+latest.config_pass+' · 传输 '+latest.transport_pass+' · <strong>真实验证 '+latest.verified_count+'</strong> · 历史保护 '+Number(latest.trusted_retained_count||0)+' · 入订阅 '+latest.included_count+' · 独占 '+latest.exclusive_count+'</p><p>类型分布：直连 '+Number(latest.direct_count||0)+' · CF原生 '+Number(latest.cf_native_count||0)+' · CF CDN '+Number(latest.cf_cdn_count||0)+' · 待确定 '+Number(latest.unknown_type_count||0)+' · CF待判 '+latest.cf_unknown_count+'</p><p>源内重复 '+dup.toFixed(1)+'% · 入订阅重合 '+overlap.toFixed(1)+'% · 近 '+recent.length+' 次平均真实验证 '+avg('verified_count')+' · 平均历史保护 '+avg('trusted_retained_count')+' · 平均独占 '+avg('exclusive_count')+(streak?' · 连续低贡献 '+streak+' 次':'')+(warn?' · <b>建议停用</b>':'')+'</p></div>'}
  function render(){if(!state)return;const s=state.settings;el('stats').innerHTML='<div class="stat"><span>当前节点</span><b>'+state.node_count+'</b></div><div class="stat"><span>启用节点源</span><b>'+state.source_count+'</b></div><div class="stat"><span>异常节点源</span><b>'+state.failed_source_count+'</b></div><div class="stat"><span>公开文章</span><b>'+state.published_count+'</b></div><div class="stat"><span>累计阅读</span><b>'+state.total_views+'</b></div><div class="stat"><span>版本</span><b>v'+state.version+'</b></div>';el('protocolStats').innerHTML=(state.protocol_stats||[]).map(function(x){return '<div class="protocol-item"><b>'+esc(x.protocol)+'</b><span>'+x.total+'</span><small>最近存活 '+x.alive+'</small></div>'}).join('')||'<div class="empty-state">还没有节点数据</div>';
    el('subs').innerHTML=state.subscriptions?'<p>'+esc(state.subscriptions.date_key)+' · 到期 '+fmt(state.subscriptions.expires_at)+'</p><div class="sub-row"><input value="'+esc(state.subscriptions.clash)+'" readonly><button class="btn" data-copy-input>复制 Clash</button></div><div class="sub-row"><input value="'+esc(state.subscriptions.v2ray)+'" readonly><button class="btn" data-copy-input>复制 V2Ray</button></div>':'<div class="empty-state">还没有可用的已发布日报，或尚未配置 SUB_TOKEN。</div>';
    el('sourceList').innerHTML=state.sources.map(function(x){return '<div class="row source-row"><div><h3>'+esc(x.name)+' <span class="pill '+(x.enabled?'live':'')+'">'+(x.enabled?'启用':'停用')+'</span> <span class="pill">'+esc(sourceClassLabel(x.node_class))+'</span>'+(x.trusted_cf?'<span class="pill live">可信 CF 历史保护</span>':'')+(x.random_whitelist?'<span class="pill live">随机直入 1/3</span>':'')+'</h3><p>上次解析 '+Number(x.last_fetch_count||0)+' 条 · '+fmt(x.last_fetch_at)+'</p>'+sourceQualityHtml(x)+(x.last_error?'<p class="error">'+esc(x.last_error)+'</p>':'')+'</div><div class="actions"><button class="btn small" data-action="edit-source" data-id="'+x.id+'">编辑</button><button class="btn small danger" data-action="delete-source" data-id="'+x.id+'">删除</button></div></div>'}).join('')||'<div class="empty-state">暂无节点源</div>';
    el('reportList').innerHTML=state.reports.map(function(r){const days=Number(state.settings.subscription_valid_days||5);const expired=r.published&&Date.now()>=Number(r.published_at||0)+days*86400000;return '<div class="row"><div><h3>'+esc(r.title)+' <span class="pill '+(r.published&&!expired?'live':expired?'warn':'')+'">'+(r.published?(expired?'订阅过期':'公开'):'隐藏')+'</span></h3><p>'+esc(r.excerpt||'暂无摘要')+' · '+fmt(r.published_at||r.created_at)+'</p></div><div class="actions"><a class="btn small" target="_blank" href="/report/'+encodeURIComponent(r.date_key)+'">查看</a><button class="btn small" data-action="edit-report" data-id="'+r.id+'">编辑</button><button class="btn small danger" data-action="delete-report" data-id="'+r.id+'">删除</button></div></div>'}).join('')||'<div class="empty-state">暂无日报</div>';
    el('articleList').innerHTML=state.articles.map(function(a){return '<div class="row"><div><h3>'+esc(a.title)+' <span class="pill '+(a.published?'live':'')+'">'+(a.published?'公开':'草稿')+'</span></h3><p>'+esc(a.category)+' · '+fmt(a.published_at||a.created_at)+' · '+Number(a.views||0)+' 阅读 · 订阅任务 #'+Number(a.subscription_run_id||0)+'</p></div><div class="actions"><a class="btn small" target="_blank" href="/article/'+encodeURIComponent(a.slug)+'">查看</a><button class="btn small" data-action="edit-article" data-id="'+a.id+'">编辑</button><button class="btn small" data-action="duplicate-article" data-id="'+a.id+'">复制</button><button class="btn small danger" data-action="delete-article" data-id="'+a.id+'">删除</button></div></div>'}).join('')||'<div class="empty-state">还没有普通文章</div>';
    el('runList').innerHTML=state.runs.map(function(r){const total=Number(r.total_unique||0);const tested=Number(r.tested||0);const pct=runProgress(r);const paused=['paused_preparing','paused_testing'].includes(r.status);const running=['preparing','testing'].includes(r.status);const indeterminate=r.status==='preparing'&&total===0;return '<div class="row"><div><h3>'+esc(r.date_key)+' · <span class="pill '+(running?'running':r.status==='published'?'live':r.status==='error'?'warn':'')+'">'+esc(STATUS_TEXT[r.status]||r.status)+'</span></h3><p>抓取 '+Number(r.total_fetched||0)+' · 去重 '+total+' · 已处理 '+tested+' · 配置 '+Number(r.config_pass||0)+' · 传输 '+Number(r.transport_pass||0)+' · 真实验证 '+Number(r.verified||0)+' · 随机直入 '+Number(r.whitelist_selected||0)+' · 未抽中 '+Number(r.whitelist_skipped||0)+' · 历史保护 '+Number(r.trusted_retained||0)+' · 入订阅 '+Number(r.alive||0)+' · CF待判 '+Number(r.cf_unknown||0)+'</p><div class="progress '+(indeterminate?'indeterminate':'')+'"><i style="width:'+pct+'%"></i></div>'+(paused?'<p>任务已暂停，当前进度会保留；继续后从未完成节点接着处理。</p>':'')+(r.status==='completed'&&r.report_due_at?'<p>预计发布：'+fmt(r.report_due_at)+'</p>':'')+(r.error?'<p class="error">'+esc(r.error)+'</p>':'')+'</div><div class="actions">'+((r.status==='completed'||r.status==='published')?'<button class="btn small" data-action="publish-run" data-id="'+r.id+'">发布 / 重发</button>':'')+(r.status==='testing'?'<button class="btn small" data-action="requeue-run" data-id="'+r.id+'">补发待测</button>':'')+(running?'<button class="btn small danger" data-action="pause-run" data-id="'+r.id+'">临时终止</button>':'')+(paused?'<button class="btn small primary" data-action="resume-run" data-id="'+r.id+'">继续任务</button>':'')+'<button class="btn small danger" data-action="delete-run" data-id="'+r.id+'">删除记录</button></div></div>'}).join('')||'<div class="empty-state">暂无任务</div>';
    if(!dirtyForms.has('copyForm'))COPY_KEYS.forEach(function(k){if(el(k))el(k).value=s[k]||''});if(!dirtyForms.has('systemForm')){SYSTEM_KEYS.forEach(function(k){if(el(k))el(k).value=s[k]||''});el('auto_publish').checked=s.auto_publish==='1';el('source_auto_disable').checked=s.source_auto_disable==='1'}
    const active=currentActiveRun();[el('startRun'),el('startRun2')].forEach(function(button){button.disabled=!!active;button.textContent=active?'已有任务运行中':'立即测活'});renderActiveTask();setSync('ok','已同步 '+formatClock(state.server_time||Date.now()));schedulePoll()}
  async function refreshState(options){options=options||{};if(loadPromise)return loadPromise;loadPromise=(async function(){if(!options.silent){setSync('syncing','正在同步…');showProgress(true)}try{const next=await api('/api/admin/state',{}, {timeout:30000});state=next;el('login').classList.add('hidden');el('app').classList.remove('hidden');render();return next}catch(error){if(error.status===401){el('login').classList.remove('hidden');el('app').classList.add('hidden');stopPolling();if(options.explicit)notify('登录已失效，请重新登录','warning')}else{setSync('error','同步失败');if(!options.silent||options.explicit)notify('同步失败：'+error.message,'error')}if(options.throwOnError)throw error;return null}finally{if(!options.silent)showProgress(false);loadPromise=null}})();return loadPromise}
  function stopPolling(){if(pollTimer){clearTimeout(pollTimer);pollTimer=null}}
  function schedulePoll(){stopPolling();if(document.hidden||!state)return;const run=currentPollingRun();let delay=0;if(run)delay=3500;else if(activeTab==='tasks')delay=15000;if(el('taskRefreshState'))el('taskRefreshState').textContent=delay?(run?'运行中，每 3.5 秒自动刷新':'当前每 15 秒刷新一次'):'没有运行中的任务';if(delay)pollTimer=setTimeout(async function(){await refreshState({silent:true});schedulePoll()},delay)}
  async function copyText(value){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);else{const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove()}notify('已复制','success')}catch(error){notify('复制失败，请长按手动复制','error')}}
  function editSource(id){const x=state.sources.find(function(v){return Number(v.id)===Number(id)});if(!x)return;el('sourceId').value=x.id;el('sourceName').value=x.name;el('sourceKind').value=x.kind;el('sourceContent').value=x.content;el('sourceEnabled').checked=!!x.enabled;el('sourceNodeClass').value=x.node_class||'auto';el('sourceTrustedCf').checked=!!x.trusted_cf;el('sourceRandomWhitelist').checked=!!x.random_whitelist;el('saveSourceButton').textContent='保存修改';window.scrollTo({top:0,behavior:'smooth'});el('sourceName').focus()}
  function editReport(id){const r=state.reports.find(function(v){return Number(v.id)===Number(id)});if(!r)return;el('reportId').value=r.id;el('reportTitle').value=r.title;el('reportExcerpt').value=r.excerpt||'';el('reportCover').value=r.cover_url||'';el('reportSeoTitle').value=r.seo_title||'';el('reportSeoDescription').value=r.seo_description||'';el('reportBody').value=r.body_text||'';el('reportPublished').checked=!!r.published;el('reportPinned').checked=!!r.pinned;el('deleteReportButton').classList.remove('hidden');openModal('reportModal')}
  function newArticle(){el('articleForm').reset();el('articleId').value='';el('articleRun').innerHTML=runOptions((state.reports.find(function(r){return r.published})||{}).run_id||0);el('deleteArticle').classList.add('hidden');openModal('articleModal')}
  function editArticle(id){const a=state.articles.find(function(v){return Number(v.id)===Number(id)});if(!a)return;el('articleId').value=a.id;el('articleTitle').value=a.title;el('articleSlug').value=a.slug;el('articleCategory').value=a.category;el('articleExcerpt').value=a.excerpt||'';el('articleCover').value=a.cover_url||'';el('articleSeoTitle').value=a.seo_title||'';el('articleSeoDescription').value=a.seo_description||'';el('articleTags').value=(a.tags||[]).join(', ');el('articleRun').innerHTML=runOptions(a.subscription_run_id);el('articleBody').value=a.body_text||'';el('articlePublished').checked=!!a.published;el('articlePinned').checked=!!a.pinned;el('deleteArticle').classList.remove('hidden');openModal('articleModal')}
  async function startTask(button){try{await performAction(button,'start-run',{loading:'正在创建任务…'},async function(){const data=await api('/api/admin/run/start',{method:'POST',body:'{}'},{timeout:30000});notify('任务 #'+data.run.id+' 已创建，正在抓取节点源','success',{duration:5200});go('tasks');await refreshState({silent:true});return data})}catch(error){if(String(error.message).includes('已有任务')){go('tasks');await refreshState({silent:true});notify('检测到已有任务，已为你切换到任务记录','warning')}}}
  async function handleAction(button){const action=button.dataset.action;const id=Number(button.dataset.id||0);if(action==='go-tasks'){go('tasks');return}if(action==='edit-source'){editSource(id);return}if(action==='edit-report'){editReport(id);return}if(action==='edit-article'){editArticle(id);return}
    if(action==='delete-source'){if(!(await askConfirm('删除节点源？','删除后，该源不会再参与下一次抓取。','删除',true)))return;try{await performAction(button,'delete-source-'+id,{loading:'正在删除…',success:'节点源已删除'},async function(){await api('/api/admin/sources/'+id,{method:'DELETE'});await refreshState({silent:true})})}catch{}return}
    if(action==='delete-report'){if(!(await askConfirm('删除这篇日报？','日报和对应公开订阅入口会被删除，关联文章可能会重新关联。','删除日报',true)))return;try{await performAction(button,'delete-report-'+id,{loading:'正在删除…',success:'日报已删除'},async function(){await api('/api/admin/reports/'+id,{method:'DELETE'});if(!el('reportModal').classList.contains('hidden')&&Number(el('reportId').value)===id)await requestCloseModal('reportModal',true);await refreshState({silent:true})})}catch{}return}
    if(action==='delete-article'){if(!(await askConfirm('删除这篇文章？','删除后无法恢复。','删除文章',true)))return;try{await performAction(button,'delete-article-'+id,{loading:'正在删除…',success:'文章已删除'},async function(){await api('/api/admin/articles/'+id,{method:'DELETE'});if(!el('articleModal').classList.contains('hidden')&&Number(el('articleId').value)===id)await requestCloseModal('articleModal',true);await refreshState({silent:true})})}catch{}return}
    if(action==='duplicate-article'){try{await performAction(button,'duplicate-article-'+id,{loading:'正在复制…',success:'已复制为草稿'},async function(){await api('/api/admin/articles/'+id+'/duplicate',{method:'POST',body:'{}'});await refreshState({silent:true})})}catch{}return}
    if(action==='publish-run'){try{await performAction(button,'publish-run-'+id,{loading:'正在生成订阅并发布…',success:'日报和订阅已发布'},async function(){await api('/api/admin/runs/'+id+'/publish',{method:'POST',body:'{}'},{timeout:90000});await refreshState({silent:true})})}catch{}return}
    if(action==='requeue-run'){try{await performAction(button,'requeue-run-'+id,{loading:'正在补发…',success:function(d){return '已补发 '+d.queued+' 个待测节点'}},async function(){const d=await api('/api/admin/runs/'+id+'/requeue',{method:'POST',body:'{}'});await refreshState({silent:true});return d})}catch{}return}
    if(action==='pause-run'){if(!(await askConfirm('临时终止任务？','已经完成的进度会保留。当前正在连接的一小批节点可能还要几秒结束。','临时终止',true)))return;try{await performAction(button,'pause-run-'+id,{loading:'正在终止…',success:'任务已临时终止'},async function(){await api('/api/admin/runs/'+id+'/pause',{method:'POST',body:'{}'});await refreshState({silent:true})})}catch{}return}
    if(action==='resume-run'){try{await performAction(button,'resume-run-'+id,{loading:'正在恢复…',success:'任务已继续'},async function(){await api('/api/admin/runs/'+id+'/resume',{method:'POST',body:'{}'});await refreshState({silent:true})})}catch{}return}
    if(action==='delete-run'){const run=state.runs.find(function(r){return Number(r.id)===id});const active=run&&ACTIVE_STATUSES.includes(run.status);if(!(await askConfirm(active?'终止并删除任务记录？':'删除任务记录？',active?'系统会先终止任务，再从列表移除。已完成的日报不会被删除。':'只从任务列表移除；已经生成的日报和订阅继续保留。','删除记录',true)))return;try{await performAction(button,'delete-run-'+id,{loading:'正在删除…',success:'任务记录已移除'},async function(){await api('/api/admin/runs/'+id+'/delete',{method:'POST',body:'{}'});await refreshState({silent:true})})}catch{}return}}
  document.addEventListener('click',function(event){const actionButton=event.target.closest('[data-action]');if(actionButton){handleAction(actionButton);return}const copyButton=event.target.closest('[data-copy-input]');if(copyButton){copyText(copyButton.previousElementSibling.value);return}const closeButton=event.target.closest('[data-close-modal]');if(closeButton){requestCloseModal(closeButton.dataset.closeModal,false)}});
  $$('[data-tab]').forEach(function(button){button.addEventListener('click',function(){go(button.dataset.tab)})});
  el('confirmAccept').onclick=function(){finishConfirm(true)};el('confirmCancel').onclick=function(){finishConfirm(false)};el('confirmModal').addEventListener('click',function(e){if(e.target===el('confirmModal'))finishConfirm(false)});
  el('loginForm').addEventListener('submit',async function(e){e.preventDefault();el('loginHint').textContent='';try{await performAction(el('loginButton'),'login',{loading:'正在登录…'},async function(){await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:el('password').value})});await refreshState({explicit:true,throwOnError:true});notify('登录成功','success')})}catch(error){el('loginHint').textContent=error.message;el('loginHint').className='login-hint error'}});
  el('logout').onclick=async function(){if(!(await askConfirm('退出后台？','退出后需要重新输入管理员密码。','退出',false)))return;try{await performAction(el('logout'),'logout',{loading:'正在退出…'},async function(){await api('/api/admin/logout',{method:'POST',body:'{}'});location.reload()})}catch{}};
  el('refresh').onclick=async function(){try{await performAction(el('refresh'),'refresh',{loading:'正在刷新…',success:'后台数据已刷新'},async function(){await refreshState({silent:true,throwOnError:true})})}catch{}};
  el('startRun').onclick=function(){startTask(el('startRun'))};el('startRun2').onclick=function(){startTask(el('startRun2'))};el('newArticleQuick').onclick=function(){go('articles');newArticle()};el('newArticleBtn').onclick=newArticle;el('resetSourceBtn').onclick=resetSource;
  el('sourceTrustedCf').addEventListener('change',function(){if(this.checked){el('sourceRandomWhitelist').checked=false;if(!['auto','cf_native'].includes(el('sourceNodeClass').value)){el('sourceNodeClass').value='cf_native';notify('已自动切换为 CF 原生节点源','info')}}});
  el('sourceRandomWhitelist').addEventListener('change',function(){if(this.checked){el('sourceTrustedCf').checked=false;notify('已开启白名单直入：本源每次纯随机抽取约 1/3，跳过网络测活','info',{duration:5200})}});
  el('sourceNodeClass').addEventListener('change',function(){if(el('sourceTrustedCf').checked&&!['auto','cf_native'].includes(this.value)){el('sourceTrustedCf').checked=false;notify('可信 CF 历史保护只适用于 CF 原生节点源','warning')}});
  el('previewSource').onclick=async function(){if(!el('sourceContent').value.trim()){notify('请先填写订阅地址或节点内容','warning');el('sourceContent').focus();return}try{await performAction(el('previewSource'),'preview-source',{loading:'正在解析…'},async function(){const d=await api('/api/admin/sources/preview',{method:'POST',body:JSON.stringify({kind:el('sourceKind').value,content:el('sourceContent').value})},{timeout:130000});const ps=Object.entries(d.protocols||{}).map(function(pair){return pair[0].toUpperCase()+' '+pair[1]}).join(' · ');el('sourcePreview').innerHTML='<b>解析到 '+d.count+' 条</b><p>'+esc(ps||'没有识别到支持的协议')+'</p><p>'+d.samples.map(function(x){return esc(x.protocol.toUpperCase()+' · '+x.host+':'+x.port)}).join('<br>')+'</p>';el('sourcePreview').classList.remove('hidden');notify('解析完成','success')})}catch{}};
  el('importSources').onclick=async function(){if(!el('bulkSources').value.trim()){notify('请先粘贴订阅地址','warning');return}try{await performAction(el('importSources'),'bulk-import',{loading:'正在导入…',success:function(d){return '导入 '+d.created+' 个，跳过 '+d.skipped+' 个'}},async function(){const d=await api('/api/admin/sources/bulk',{method:'POST',body:JSON.stringify({text:el('bulkSources').value})},{timeout:60000});el('bulkSources').value='';await refreshState({silent:true});return d})}catch{}};
  el('downloadBackup').onclick=async function(){try{await performAction(el('downloadBackup'),'backup',{loading:'正在导出…',success:'备份已生成'},async function(){const controller=new AbortController();const timer=setTimeout(function(){controller.abort()},60000);try{const response=await fetch('/api/admin/backup',{credentials:'same-origin',signal:controller.signal});if(!response.ok)throw new Error('备份失败');const blob=await response.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cactus-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},1000)}finally{clearTimeout(timer)}})}catch{}};
  el('sourceForm').addEventListener('submit',async function(e){e.preventDefault();const id=el('sourceId').value;const button=e.submitter||el('saveSourceButton');try{await performAction(button,'save-source-'+(id||'new'),{loading:'正在保存…',success:'节点源已保存'},async function(){await api(id?'/api/admin/sources/'+id:'/api/admin/sources',{method:id?'PUT':'POST',body:JSON.stringify({name:el('sourceName').value,kind:el('sourceKind').value,content:el('sourceContent').value,enabled:el('sourceEnabled').checked,node_class:el('sourceNodeClass').value,trusted_cf:el('sourceTrustedCf').checked,random_whitelist:el('sourceRandomWhitelist').checked})});resetSource();await refreshState({silent:true})})}catch{}});
  el('reportForm').addEventListener('submit',async function(e){e.preventDefault();const id=el('reportId').value;const button=e.submitter||el('saveReportButton');try{await performAction(button,'save-report-'+id,{loading:'正在保存…',success:'日报已保存'},async function(){await api('/api/admin/reports/'+id,{method:'PUT',body:JSON.stringify({title:el('reportTitle').value,excerpt:el('reportExcerpt').value,cover_url:el('reportCover').value,seo_title:el('reportSeoTitle').value,seo_description:el('reportSeoDescription').value,body_text:el('reportBody').value,published:el('reportPublished').checked,pinned:el('reportPinned').checked})},{timeout:60000});await requestCloseModal('reportModal',true);await refreshState({silent:true})})}catch{}});
  el('articleForm').addEventListener('submit',async function(e){e.preventDefault();const id=el('articleId').value;const button=e.submitter||el('saveArticleButton');try{await performAction(button,'save-article-'+(id||'new'),{loading:'正在保存…',success:'文章已保存'},async function(){await api(id?'/api/admin/articles/'+id:'/api/admin/articles',{method:id?'PUT':'POST',body:JSON.stringify({title:el('articleTitle').value,slug:el('articleSlug').value,category:el('articleCategory').value,excerpt:el('articleExcerpt').value,cover_url:el('articleCover').value,seo_title:el('articleSeoTitle').value,seo_description:el('articleSeoDescription').value,tags:el('articleTags').value,subscription_run_id:Number(el('articleRun').value||0),body_text:el('articleBody').value,published:el('articlePublished').checked,pinned:el('articlePinned').checked})},{timeout:60000});await requestCloseModal('articleModal',true);await refreshState({silent:true})})}catch{}});
  el('deleteArticle').onclick=function(){const id=Number(el('articleId').value||0);if(!id)return;const button=document.createElement('button');button.dataset.action='delete-article';button.dataset.id=String(id);handleAction(button)};
  el('deleteReportButton').onclick=function(){const id=Number(el('reportId').value||0);if(!id)return;const button=document.createElement('button');button.dataset.action='delete-report';button.dataset.id=String(id);handleAction(button)};
  el('copyForm').addEventListener('submit',async function(e){e.preventDefault();const button=e.submitter||el('saveCopyButton');try{await performAction(button,'save-copy',{loading:'正在保存…',success:'前台文案已保存'},async function(){const body=Object.fromEntries(COPY_KEYS.map(function(k){return [k,el(k).value]}));await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(body)});clearDirty('copyForm');await refreshState({silent:true})})}catch{}});
  el('systemForm').addEventListener('submit',async function(e){e.preventDefault();const button=e.submitter||el('saveSystemButton');try{await performAction(button,'save-system',{loading:'正在保存…',success:'系统设置已保存'},async function(){const body=Object.fromEntries(SYSTEM_KEYS.map(function(k){return [k,el(k).value]}));body.auto_publish=el('auto_publish').checked?'1':'0';body.source_auto_disable=el('source_auto_disable').checked?'1':'0';await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(body)});clearDirty('systemForm');await refreshState({silent:true})})}catch{}});
  ['copyForm','systemForm'].forEach(function(id){const form=el(id);form.addEventListener('input',function(){markDirty(form)});form.addEventListener('change',function(){markDirty(form)})});
  el('reportModal').addEventListener('click',function(e){if(e.target===el('reportModal'))requestCloseModal('reportModal',false)});el('articleModal').addEventListener('click',function(e){if(e.target===el('articleModal'))requestCloseModal('articleModal',false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(!el('confirmModal').classList.contains('hidden'))finishConfirm(false);else if(!el('articleModal').classList.contains('hidden'))requestCloseModal('articleModal',false);else if(!el('reportModal').classList.contains('hidden'))requestCloseModal('reportModal',false)}});
  document.addEventListener('visibilitychange',schedulePoll);window.addEventListener('offline',function(){el('networkBanner').classList.remove('hidden');setSync('error','网络已断开');stopPolling()});window.addEventListener('online',function(){el('networkBanner').classList.add('hidden');notify('网络已恢复，正在同步','success');refreshState({silent:true})});window.addEventListener('beforeunload',function(e){if(dirtyForms.size){e.preventDefault();e.returnValue=''}});
  refreshState({silent:true});
  </script></body></html>`;

}

async function handleLogin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return jsonResponse({ ok: false, error: "请先配置 ADMIN_PASSWORD 和 SESSION_SECRET" }, 503);
  }
  if (!sameOrigin(request)) return jsonResponse({ ok: false, error: "来源校验失败" }, 403);
  const body = await readJson(request);
  if (!(await timingSafeEqual(String(body.password || ""), env.ADMIN_PASSWORD))) {
    return jsonResponse({ ok: false, error: "密码错误" }, 401);
  }
  const token = await createSessionToken(env);
  return jsonResponse({ ok: true }, 200, {
    "Set-Cookie": `cactus_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`,
  });
}

async function createSessionToken(env) {
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  const nonce = crypto.randomUUID();
  const payload = `${expires}.${nonce}`;
  const signature = await hmacHex(env.SESSION_SECRET, payload);
  return encodeBase64UrlUtf8(`${payload}.${signature}`);
}

async function isAdminRequest(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const token = cookies.cactus_admin;
  if (!token) return false;
  try {
    const decoded = decodeBase64UrlUtf8(token);
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [expires, nonce, signature] = parts;
    if (Number(expires) < Date.now()) return false;
    const expected = await hmacHex(env.SESSION_SECRET, `${expires}.${nonce}`);
    return timingSafeEqual(signature, expected);
  } catch {
    return false;
  }
}

async function ensureSchema(env) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await env.DB.batch(SCHEMA_STATEMENTS.map((sql) => env.DB.prepare(sql)));
      await ensureColumn(env, "sources", "public_alias", "TEXT");
      await ensureColumn(env, "sources", "node_class", "TEXT NOT NULL DEFAULT 'auto'");
      await ensureColumn(env, "sources", "trusted_cf", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "sources", "random_whitelist", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "report_meta", "cover_url", "TEXT");
      await ensureColumn(env, "report_meta", "seo_title", "TEXT");
      await ensureColumn(env, "report_meta", "seo_description", "TEXT");
      await ensureColumn(env, "articles", "seo_title", "TEXT");
      await ensureColumn(env, "articles", "seo_description", "TEXT");
      await ensureColumn(env, "articles", "subscription_run_id", "INTEGER");
      await ensureColumn(env, "runs", "admin_hidden", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "config_pass", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "transport_pass", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "verified", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "transport_only", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "cf_unknown", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "invalid", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "verify_failed", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "trusted_retained", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "whitelist_selected", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "runs", "whitelist_skipped", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "run_nodes", "config_ok", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "run_nodes", "transport_status", "TEXT");
      await ensureColumn(env, "run_nodes", "verify_status", "TEXT");
      await ensureColumn(env, "run_nodes", "result_level", "TEXT");
      await ensureColumn(env, "run_nodes", "node_class", "TEXT");
      await ensureColumn(env, "run_nodes", "trusted_source", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "run_nodes", "included_reason", "TEXT");
      await ensureColumn(env, "run_nodes", "probe_method", "TEXT");
      await ensureColumn(env, "run_nodes", "exit_ip", "TEXT");
      await ensureColumn(env, "run_nodes", "exit_loc", "TEXT");
      await ensureColumn(env, "nodes", "last_result_level", "TEXT");
      await ensureColumn(env, "nodes", "last_transport_ok", "INTEGER");
      await ensureColumn(env, "nodes", "last_verified", "INTEGER");
      await ensureColumn(env, "nodes", "node_class", "TEXT NOT NULL DEFAULT 'unknown'");
      await ensureColumn(env, "nodes", "last_verified_success_at", "INTEGER");
      await ensureColumn(env, "nodes", "consecutive_verify_failures", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "nodes", "consecutive_verify_successes", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "nodes", "last_probe_method", "TEXT");
      await ensureColumn(env, "nodes", "last_exit_ip", "TEXT");
      await ensureColumn(env, "nodes", "last_exit_loc", "TEXT");
      await ensureColumn(env, "source_run_stats", "trusted_retained_count", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "source_run_stats", "whitelist_selected_count", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "source_run_stats", "whitelist_skipped_count", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "run_node_sources", "whitelist_selected", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "run_node_sources", "whitelist_skipped", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "source_run_stats", "direct_count", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "source_run_stats", "cf_native_count", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "source_run_stats", "cf_cdn_count", "INTEGER NOT NULL DEFAULT 0");
      await ensureColumn(env, "source_run_stats", "unknown_type_count", "INTEGER NOT NULL DEFAULT 0");
      await env.DB.prepare(`UPDATE sources SET public_alias=name WHERE public_alias IS NULL OR public_alias=''`).run();
      await env.DB.batch(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => env.DB.prepare(
        `INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)`
      ).bind(key, value)));
      await env.DB.batch(LEGACY_COPY_MIGRATIONS.map(([key, oldValue, newValue]) => env.DB.prepare(
        `UPDATE settings SET value=? WHERE key=? AND value=?`
      ).bind(newValue, key, oldValue)));
      await env.DB.prepare(`UPDATE articles SET category='免费节点' WHERE category IN ('使用教程','客户端')`).run();
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}


async function ensureColumn(env, table, column, definition) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  if ((info.results || []).some((row) => row.name === column)) return;
  await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

async function markRunError(env, runId, error) {
  if (!runId) return;
  await env.DB.prepare(
    `UPDATE runs SET status='error', error=?
     WHERE id=? AND status NOT IN ('paused_preparing','paused_testing','completed','published','deleted')`
  ).bind(String(error).slice(0, 1000), runId).run();
}

function categoryNameFromSlug(slug){return ({'free-nodes':'免费节点','airports':'机场推荐'})[String(slug||'')]||'';}
function categorySlugFromName(name){return ({'免费节点':'free-nodes','机场推荐':'airports'})[String(name||'')]||'free-nodes';}
function safeSlug(value){const raw=String(value||'').trim().toLowerCase();const slug=raw.replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');return slug||`post-${Date.now().toString(36)}`;}
function validateArticle(body,current=null){
  const title=String(body?.title||'').trim().slice(0,160); if(!title)throw new Error('文章标题不能为空');
  const bodyText=String(body?.body_text||'').trim().slice(0,50000); if(!bodyText)throw new Error('文章正文不能为空');
  const excerpt=String(body?.excerpt||'').trim().slice(0,300);
  const category=['免费节点','机场推荐'].includes(body?.category)?body.category:'免费节点';
  const tags=String(body?.tags||'').split(/[,，]/).map(v=>v.trim()).filter(Boolean).slice(0,12);
  const cover=validateOptionalHttpUrl(body?.cover_url,'封面链接');
  const seoTitle=String(body?.seo_title||'').trim().slice(0,160);
  const seoDescription=String(body?.seo_description||'').trim().slice(0,300);
  const requestedRun=Number(body?.subscription_run_id||current?.subscription_run_id||0);
  return {
    title,
    slug:safeSlug(body?.slug||current?.slug||title),
    excerpt:excerpt||bodyText.replace(/\s+/g,' ').slice(0,120),
    body_text:bodyText,
    category,
    tags,
    cover_url:cover,
    seo_title:seoTitle,
    seo_description:seoDescription,
    subscription_run_id:Number.isInteger(requestedRun)&&requestedRun>0?requestedRun:null,
    published:body?.published===true,
    pinned:body?.pinned===true,
  };
}

async function resolveArticleRunId(env, requestedRunId, published) {
  const settings = await getSettings(env);
  if (requestedRunId) {
    const run = await env.DB.prepare(
      `SELECT r.id,p.published_at FROM runs r JOIN reports p ON p.run_id=r.id WHERE r.id=? AND p.published=1`
    ).bind(requestedRunId).first();
    if (!run) throw new Error("关联的订阅日报不存在或尚未公开");
    if (!subscriptionValidity(run.published_at, settings).valid) throw new Error(`这篇日报的订阅已经过期，请选择 ${clampNumber(settings.subscription_valid_days,1,30,5)} 天内的日报`);
    return Number(run.id);
  }
  if (!published) return null;
  const validAfter = Date.now() - clampNumber(settings.subscription_valid_days, 1, 30, 5) * DAY_MS;
  const latest = await env.DB.prepare(
    `SELECT run_id FROM reports WHERE published=1 AND published_at>? ORDER BY published_at DESC LIMIT 1`
  ).bind(validAfter).first();
  if (!latest) throw new Error("公开文章前，请先发布一篇仍在有效期内的节点日报");
  return Number(latest.run_id);
}

function validateOptionalHttpUrl(value, label = "链接") {
  const text=String(value||'').trim();
  if(!text)return '';
  const url=new URL(text);
  if(!['http:','https:'].includes(url.protocol))throw new Error(`${label}必须是 HTTP/HTTPS`);
  return text;
}
async function incrementContentView(env,type,id){try{await env.DB.prepare(`INSERT INTO content_views(content_type,content_id,views) VALUES(?,?,1) ON CONFLICT(content_type,content_id) DO UPDATE SET views=views+1`).bind(type,id).run();if(type==='article')await env.DB.prepare(`UPDATE articles SET views=views+1 WHERE id=?`).bind(id).run();}catch{}}
function postCoverHtml(item,large=false){if(item.cover_url)return `<img src="${escapeHtml(item.cover_url)}" alt="${escapeHtml(item.title)}" loading="lazy">`;const label=item.category||'文章';return `<div class="auto-cover ${large?'large':''}"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(item.title||'').slice(0,24))}</b></div>`;}

function validateSource(body) {
  const name = String(body?.name || "").trim().slice(0, 100);
  const kind = body?.kind === "text" ? "text" : "url";
  const content = String(body?.content || "").trim();
  if (!name) throw new Error("请填写节点源名称");
  if (!content) throw new Error("请填写订阅地址或节点内容");
  if (content.length > 5_000_000) throw new Error("节点源内容不能超过 5MB");
  if (kind === "url") {
    const url = new URL(content);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("订阅地址只允许 HTTP/HTTPS");
  }
  const publicAlias = cleanNodeName(name).slice(0, 60);
  const nodeClass = ["auto", "direct", "cf_native", "cf_cdn", "unknown"].includes(String(body?.node_class || "auto"))
    ? String(body?.node_class || "auto")
    : "auto";
  const randomWhitelist = body?.random_whitelist === true || body?.random_whitelist === 1 || body?.random_whitelist === "1";
  let trustedCf = body?.trusted_cf === true || body?.trusted_cf === 1 || body?.trusted_cf === "1";
  if (randomWhitelist) trustedCf = false;
  if (trustedCf && !["auto", "cf_native"].includes(nodeClass)) throw new Error("可信 CF 历史保护只能用于自动识别或 CF 原生节点源");
  return {
    name,
    public_alias: publicAlias,
    kind,
    content,
    enabled: body?.enabled !== false,
    node_class: nodeClass,
    trusted_cf: trustedCf,
    random_whitelist: randomWhitelist,
  };
}

function validateSettings(settings) {
  if (settings.daily_test_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(settings.daily_test_time))) {
    throw new Error("测活时间格式不正确");
  }
  if (settings.report_delay_minutes != null) {
    const value = Number(settings.report_delay_minutes);
    if (!Number.isInteger(value) || value < 1 || value > 1440) throw new Error("报告延迟必须为 1–1440 分钟");
  }
  if (settings.posts_per_page != null) {
    const value = Number(settings.posts_per_page);
    if (!Number.isInteger(value) || value < 4 || value > 20) throw new Error("每页文章数量必须为 4–20");
  }
  const numericRanges = {
    source_fetch_concurrency: [1, 10, "节点源抓取并发"],
    source_timeout_ms: [5000, 120000, "节点源抓取超时"],
    health_message_nodes: [5, 25, "每条消息节点数"],
    health_concurrency: [1, 5, "测活并发"],
    health_timeout_ms: [1000, 10000, "快速检查超时"],
    health_recheck_timeout_ms: [2000, 15000, "疑似节点复检超时"],
    trusted_cf_success_days: [1, 30, "可信 CF 成功状态保留天数"],
    trusted_cf_failure_limit: [2, 10, "可信 CF 连续失败移除次数"],
    subscription_valid_days: [1, 30, "订阅有效天数"],
    subscription_max_nodes: [0, 100000, "单份订阅最大节点数"],
    theme_radius: [8, 36, "界面圆角"],
    source_low_quality_runs: [3, 20, "低质量判断次数"],
    source_low_quality_verified_max: [0, 1000, "低质量真实验证阈值"],
  };
  for (const [key, [min, max, label]] of Object.entries(numericRanges)) {
    if (settings[key] == null) continue;
    const value = Number(settings[key]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label}必须为 ${min}–${max}`);
  }
  for (const key of ["telegram_url", "airport_url", "site_logo_url"]) {
    if (settings[key]) {
      const url = new URL(String(settings[key]));
      if (!["http:", "https:"].includes(url.protocol)) throw new Error(`${key} 必须是 HTTP/HTTPS 链接`);
    }
  }
  for (const key of ["theme_primary", "theme_ink", "theme_background"]) {
    if (settings[key] && !/^#[0-9a-fA-F]{6}$/.test(String(settings[key]))) {
      throw new Error(`${key} 必须是 6 位十六进制颜色，例如 #2563eb`);
    }
  }
  if (settings.health_quality_mode != null && !["verified_only","verified_and_transport","all_nonfailed"].includes(String(settings.health_quality_mode))) {
    throw new Error("订阅纳入等级设置不正确");
  }
  if (settings.source_auto_disable != null && !["0", "1", 0, 1, false, true].includes(settings.source_auto_disable)) {
    throw new Error("节点源自动停用设置不正确");
  }
  if (settings.subscription_shuffle != null && !["0", "1", 0, 1, false, true].includes(settings.subscription_shuffle)) {
    throw new Error("订阅随机排序设置不正确");
  }
}

function parseTimeToMinutes(value) {
  const match = String(value || "16:00").match(/^(\d{2}):(\d{2})$/);
  if (!match) return 16 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function shanghaiParts(timestamp) {
  const date = new Date(timestamp + SHANGHAI_OFFSET_MINUTES * 60_000);
  const iso = date.toISOString();
  return {
    date: iso.slice(0, 10),
    hour: Number(iso.slice(11, 13)),
    minute: Number(iso.slice(14, 16)),
    second: Number(iso.slice(17, 19)),
    hourString: iso.slice(11, 13),
    minuteString: iso.slice(14, 16),
    secondString: iso.slice(17, 19),
  };
}

function humanDateFromDateKey(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(dateKey || "");
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function formatDateTime(timestamp) {
  if (!timestamp) return "—";
  const p = shanghaiParts(Number(timestamp));
  return `${p.date} ${p.hourString}:${p.minuteString}:${p.secondString}`;
}

function defaultPortForProtocol(protocol) {
  return ["trojan", "hysteria2", "hy2", "tuic"].includes(protocol) ? 443 : 0;
}

function parseHostPort(value) {
  const text = String(value || "");
  if (text.startsWith("[")) {
    const end = text.indexOf("]");
    return { host: text.slice(1, end), port: Number(text.slice(end + 2)) };
  }
  const idx = text.lastIndexOf(":");
  return { host: text.slice(0, idx), port: Number(text.slice(idx + 1)) };
}

function formatHostPort(host, port) {
  const value = String(host || "");
  return `${value.includes(":") && !value.startsWith("[") ? `[${value}]` : value}:${Number(port)}`;
}

function cleanNodeName(value) {
  const name = String(value || "node").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return (name || "node").slice(0, 120);
}

function splitOnce(value, separator) {
  const index = value.indexOf(separator);
  return index < 0 ? [value, ""] : [value.slice(0, index), value.slice(index + separator.length)];
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  let normalized = String(value || "").trim().replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  normalized += "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64UrlUtf8(value) {
  return encodeBase64Utf8(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlUtf8(value) {
  return decodeBase64Utf8(value);
}

function parseCookies(header) {
  const result = {};
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) result[key] = rest.join("=");
  }
  return result;
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new Error("请求 JSON 格式错误"); }
}

function safeJsonParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function friendlyError(error) {
  if (!error) return "未知错误";
  if (typeof error === "string") return error;
  return error.message || String(error);
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...securityHeaders(), ...extraHeaders },
  });
}

function htmlResponse(html, status = 200, extraHeaders = {}) {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...securityHeaders(), ...extraHeaders },
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function textToSafeHtml(value) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "<p></p>";
  return text.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return "";
    if (lines.every((line) => line.startsWith("- "))) {
      return `<ul>${lines.map((line) => `<li>${escapeHtml(line.slice(2))}</li>`).join("")}</ul>`;
    }
    if (lines.length === 1 && lines[0].startsWith("## ")) return `<h2>${escapeHtml(lines[0].slice(3))}</h2>`;
    return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
  }).join("\n");
}

function htmlToPlainText(value) {
  return String(value || "")
    .replace(/<\/p>/gi, "\n\n").replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/h2>/gi, "\n\n").replace(/<h2[^>]*>/gi, "## ")
    .replace(/<li[^>]*>/gi, "- ").replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

function excerptFromHtml(value, maxLength = 180) {
  const text = htmlToPlainText(value).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}…` : text;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[char]);
}

function notFoundHtml(message = "页面不存在") {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title>${sharedStyles()}</head><body><main class="simple-page"><span class="eyebrow">404</span><h1>${escapeHtml(message)}</h1><div class="prose"><p>这个页面可能已经被删除、隐藏或链接已经失效。</p><a class="button primary" href="/">返回首页</a></div></main></body></html>`;
}

function sharedStyles() {
  return `<style>
  *{box-sizing:border-box}html{scroll-behavior:smooth}
  :root{--brand:#2563eb;--brand2:#06b6d4;--ink:#0f172a;--page:#f4f7fb;--radius:16px;--card:#fff;--card-soft:#f8fafc;--muted:#667085;--line:#e3e9f2;--soft:#eef4ff;--shadow:0 14px 38px rgba(15,23,42,.08);--sans:Inter,"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif}
  :root[data-theme="dark"]{--page:#0b1120;--card:#111827;--card-soft:#0f172a;--ink:#edf3ff;--muted:#94a3b8;--line:#263247;--soft:#18243a;--shadow:0 18px 48px rgba(0,0,0,.28)}
  body{margin:0;background:var(--page);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.65;text-rendering:optimizeLegibility}a{color:inherit;text-decoration:none}button,input,textarea,select{font:inherit}img{display:block;max-width:100%}
  .promo-ribbon{min-height:42px;padding:8px max(18px,calc((100% - 1180px)/2));display:flex;align-items:center;gap:12px;background:#0f172a;color:#fff}.promo-ribbon span{background:#1d4ed8;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:800}.promo-ribbon b{font-size:13px}.promo-ribbon p{margin:0;color:#b8c4d8;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.promo-ribbon i{margin-left:auto;font-style:normal;color:#bfdbfe;font-size:12px;white-space:nowrap}
  .site-header{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--card) 94%,transparent);border-bottom:1px solid var(--line);backdrop-filter:blur(14px)}.header-inner{width:min(1180px,calc(100% - 32px));height:72px;margin:auto;display:flex;align-items:center;gap:26px}.brand{display:flex;align-items:center;gap:11px;min-width:210px}.brand-mark{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#2563eb,#06b6d4);color:#fff;font-weight:900;box-shadow:0 8px 20px rgba(37,99,235,.22);overflow:hidden}.brand-mark>span{display:grid;place-items:center;width:100%;height:100%}.brand-mark img{width:100%;height:100%;object-fit:cover}.brand-copy{display:grid;line-height:1.15}.brand-copy b{font-size:18px}.brand-copy small{margin-top:5px;color:var(--muted);font-size:10px}.header-inner nav{display:flex;gap:3px;margin-left:auto}.header-inner nav a{padding:9px 12px;border-radius:9px;color:var(--muted);font-size:13px;font-weight:700}.header-inner nav a:hover,.header-inner nav a.active{background:var(--soft);color:var(--brand)}.header-tools{display:flex;gap:7px}.search-button,.theme-button,.menu-button{width:38px;height:38px;border:1px solid var(--line);background:var(--card);border-radius:10px;display:grid;place-items:center;color:var(--ink);cursor:pointer}.menu-button{display:none}.menu-button i{width:17px;height:2px;background:currentColor;display:block;margin:2px}
  .announcement{width:min(1180px,calc(100% - 32px));margin:14px auto 0;padding:10px 14px;border:1px solid #cfe0ff;background:#eef5ff;border-radius:10px;display:flex;justify-content:space-between;align-items:center;gap:16px}.announcement p{margin:0;color:#38547a;font-size:12px}.announcement a{color:#1d4ed8;font-size:12px;font-weight:800;white-space:nowrap}:root[data-theme="dark"] .announcement{background:#12213b;border-color:#243b64}.home-banner{width:min(1180px,calc(100% - 32px));margin:20px auto 0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);gap:28px;padding:44px;background:linear-gradient(130deg,#0f172a 0%,#173b72 58%,#0891b2 140%);border-radius:22px;box-shadow:0 20px 55px rgba(15,23,42,.18);color:#fff;overflow:hidden;position:relative}.home-banner:after{content:"";position:absolute;width:380px;height:380px;border-radius:50%;right:-180px;top:-200px;background:rgba(255,255,255,.08)}.banner-copy,.banner-feature{position:relative;z-index:1}.banner-badge{display:inline-block;padding:5px 9px;border:1px solid rgba(255,255,255,.26);border-radius:999px;color:#dbeafe;font-size:11px;font-weight:800}.banner-copy h1{margin:18px 0 13px;font-size:clamp(36px,5vw,58px);line-height:1.12;letter-spacing:-.04em}.banner-copy h1 em{display:block;color:#67e8f9;font-style:normal}.banner-copy>p{margin:0;max-width:650px;color:#c8d8ef;font-size:16px}.hero-search{display:flex;max-width:590px;margin-top:25px;background:#fff;border-radius:12px;padding:5px;box-shadow:0 12px 30px rgba(0,0,0,.16)}.hero-search input{flex:1;min-width:0;border:0;outline:0;padding:10px 12px;color:#0f172a}.hero-search button{border:0;background:#2563eb;color:#fff;border-radius:9px;padding:9px 18px;font-weight:800;cursor:pointer}.banner-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.banner-links a{padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.1);color:#dcecff;font-size:10px}.banner-copy>small{display:block;margin-top:17px;color:#9fb5d3}.banner-feature{align-self:stretch;background:rgba(255,255,255,.96);color:#0f172a;border-radius:16px;padding:26px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 16px 38px rgba(0,0,0,.16)}.banner-feature>span{color:#2563eb;font-size:11px;font-weight:850}.banner-feature h2{font-size:27px;line-height:1.32;margin:10px 0}.banner-feature p{color:#64748b;font-size:13px;margin:0 0 18px}.banner-feature b{color:#1d4ed8;font-size:12px}.banner-feature.empty{opacity:.92}
  .quick-stats{width:min(1120px,calc(100% - 48px));margin:-14px auto 0;position:relative;z-index:3;display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);overflow:hidden}.quick-stats>div{padding:16px 20px;border-left:1px solid var(--line)}.quick-stats>div:first-child{border-left:0}.quick-stats small{display:block;color:var(--muted);font-size:10px}.quick-stats b{display:block;margin-top:4px;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .content-shell{width:min(1180px,calc(100% - 32px));margin:48px auto 72px;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:25px}.content-main{min-width:0}.content-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}.content-heading span{color:var(--brand);font-size:11px;font-weight:800}.content-heading h2{margin:3px 0 0;font-size:29px}.inline-search{display:flex;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:4px}.inline-search input{width:205px;border:0;background:transparent;outline:0;padding:8px 9px;color:var(--ink)}.inline-search button{border:0;background:var(--brand);color:#fff;border-radius:7px;padding:7px 12px;font-weight:800;cursor:pointer}.story-list{display:grid;gap:14px}.story-card{display:grid;grid-template-columns:235px minmax(0,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:.2s}.story-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:#cbd8ed}.story-cover{min-height:166px;overflow:hidden}.story-cover img,.story-cover>.auto-cover{width:100%;height:100%;min-height:166px;object-fit:cover}.auto-cover{padding:20px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(145deg,#172554,#0e7490);color:#fff;position:relative;overflow:hidden}.auto-cover:before{content:"";position:absolute;width:170px;height:170px;border-radius:50%;right:-70px;top:-70px;background:rgba(103,232,249,.22)}.auto-cover span,.auto-cover b{position:relative;z-index:1}.auto-cover span{font-size:10px;font-weight:800}.auto-cover b{font-size:22px;line-height:1.25}.auto-cover.large{min-height:300px}.story-body{padding:19px 21px}.story-meta{display:flex;gap:9px;flex-wrap:wrap;color:var(--muted);font-size:10px}.story-meta a{color:var(--brand);font-weight:800}.story-body h2{font-size:22px;line-height:1.38;margin:9px 0}.story-body>p{margin:0;color:var(--muted);font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.story-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}.story-foot>div{display:flex;gap:6px;flex-wrap:wrap}.story-foot span{font-size:9px;padding:3px 7px;border-radius:999px;background:var(--soft);color:#45648f}.story-foot>a{color:var(--brand);font-size:11px;font-weight:800;white-space:nowrap}
  .content-side{display:grid;align-content:start;gap:14px}.side-card{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}.side-card>span{color:var(--brand);font-size:10px;font-weight:800}.side-card h3{font-size:19px;line-height:1.35;margin:7px 0}.side-card p{color:var(--muted);font-size:12px;margin:0 0 12px}.side-card>b,.side-card>a{color:var(--brand);font-size:11px}.status-card{border-top:3px solid var(--brand)}.telegram-card{background:linear-gradient(145deg,#ecfeff,#f8fbff)}:root[data-theme="dark"] .telegram-card{background:#102333}.airport-card{background:linear-gradient(145deg,#eef5ff,#fff)}:root[data-theme="dark"] .airport-card{background:#13213a}.side-title{margin-bottom:6px}.mini-story{display:grid;gap:4px;padding:10px 0;border-top:1px solid var(--line)}.mini-story:first-of-type{border-top:0}.mini-story b{font-size:12px;line-height:1.4}.mini-story span{font-size:9px;color:var(--muted)}.hot-story{display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.hot-story:first-of-type{border-top:0}.hot-story i{font-style:normal;width:22px;height:22px;border-radius:6px;background:var(--soft);color:var(--brand);display:grid;place-items:center;font-size:10px;font-weight:900}.hot-story b,.hot-story span{display:block}.hot-story b{font-size:12px;line-height:1.35}.hot-story span{font-size:9px;color:var(--muted);margin-top:3px}.tags-card>div:last-child{display:flex;flex-wrap:wrap;gap:7px}.tags-card a{padding:5px 9px;border-radius:999px;background:var(--soft);font-size:10px;color:#45648f}.empty-state{min-height:300px;background:var(--card);border:1px dashed #cbd5e1;border-radius:14px;display:grid;place-items:center;align-content:center;text-align:center;padding:30px}.empty-state h3{font-size:24px;margin:0 0 7px}.empty-state p{color:var(--muted)}.empty-state a{color:var(--brand);font-weight:800}.pagination{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-top:20px;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:12px}.pagination a:last-child{text-align:right}.pagination b{font-size:10px;color:var(--muted)}
  .faq-section{width:min(1180px,calc(100% - 32px));margin:0 auto 75px}.section-heading span{color:var(--brand);font-size:11px;font-weight:800}.section-heading h2{font-size:28px;margin:3px 0 16px}.faq-list{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.faq-list details{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:17px}.faq-list summary{font-weight:800;cursor:pointer;list-style:none;display:flex;justify-content:space-between}.faq-list summary i{font-style:normal;color:var(--brand)}.faq-list p{color:var(--muted);font-size:12px}.site-footer{background:#0f172a;color:#fff;padding:48px max(18px,calc((100% - 1180px)/2)) 22px}.footer-top{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px}.footer-brand p{max-width:520px;color:#aab8ce}.site-footer .brand-copy small{color:#94a3b8}.footer-top>div:not(.footer-brand){display:grid;align-content:start;gap:8px}.footer-top>div>b{margin-bottom:7px}.footer-top>div>a{color:#aab8ce;font-size:12px}.footer-bottom{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #26344b;margin-top:34px;padding-top:17px;color:#7f91aa;font-size:10px}
  .reading-progress{position:fixed;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,var(--brand),#06b6d4);z-index:100;transform:scaleX(0);transform-origin:left center}.article-layout{width:min(900px,calc(100% - 32px));margin:34px auto 72px}.article-paper{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:clamp(24px,5vw,58px);box-shadow:0 10px 34px rgba(15,23,42,.06)}.breadcrumbs{display:flex;gap:8px;color:var(--muted);font-size:10px}.article-hero{padding:24px 0 27px;border-bottom:1px solid var(--line)}.article-kicker{color:var(--brand);font-size:11px;font-weight:800}.article-hero h1{font-size:clamp(34px,5.3vw,52px);line-height:1.2;letter-spacing:-.04em;margin:12px 0 14px}.article-hero>p{font-size:16px;color:var(--muted);max-width:760px}.article-byline{display:flex;gap:9px;align-items:center;flex-wrap:wrap;color:var(--muted);font-size:10px}.article-byline i{width:3px;height:3px;border-radius:50%;background:var(--muted)}.article-byline button{border:0;background:transparent;color:var(--brand);padding:0;cursor:pointer}.article-cover{width:100%;max-height:500px;object-fit:cover;border-radius:14px;margin:26px 0}.report-numbers{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:13px;overflow:hidden;margin:26px 0}.report-numbers>div{padding:15px;border-left:1px solid var(--line)}.report-numbers>div:first-child{border:0}.report-numbers small,.report-numbers b{display:block}.report-numbers small{font-size:9px;color:var(--muted)}.report-numbers b{font-size:25px}.article-body{font-size:17px;line-height:1.9;padding:15px 0}.article-body h2{font-size:25px;line-height:1.35;margin:1.7em 0 .6em}.article-body h3{font-size:20px}.article-body p{margin:1em 0}.article-body ul{padding-left:1.3em}.article-body strong{color:var(--brand)}.article-body a{color:var(--brand);text-decoration:underline}.subscription-panel{margin:32px 0;padding:25px;border-radius:16px;background:linear-gradient(135deg,#0f172a,#1e3a8a 70%,#0891b2);color:#fff;display:grid;grid-template-columns:1fr 330px;gap:25px;align-items:center}.subscription-panel.expired{background:linear-gradient(135deg,#374151,#111827);grid-template-columns:1fr auto}.subscription-copy>span{font-size:10px;color:#93c5fd;font-weight:800}.subscription-copy h2{font-size:27px;margin:6px 0}.subscription-copy>p{color:#c7d7ee;font-size:12px}.subscription-validity{display:flex;gap:8px;align-items:center;margin-top:13px}.subscription-validity b{background:#2563eb;border-radius:999px;padding:4px 8px;font-size:9px}.subscription-validity i{font-style:normal;color:#afc1db;font-size:10px}.subscription-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.subscription-actions a{position:relative;padding:13px;background:#fff;color:#0f172a;border-radius:10px}.subscription-actions strong,.subscription-actions small{display:block}.subscription-actions strong{font-size:16px}.subscription-actions small{font-size:9px;color:#64748b}.subscription-actions a i{position:absolute;right:12px;top:12px;font-style:normal}.subscription-actions button{border:1px solid rgba(255,255,255,.28);background:transparent;color:#dce8fa;border-radius:9px;padding:7px;cursor:pointer;font-size:10px}.subscription-latest{background:#fff;color:#0f172a;border-radius:10px;padding:10px 13px;font-weight:800;font-size:12px}.article-note{border:1px solid #cfe0ff;background:#f0f6ff;border-radius:12px;padding:15px;margin:20px 0;color:#29476e}:root[data-theme="dark"] .article-note{background:#13233d;color:#b9d4ff;border-color:#27446e}.article-note p{font-size:12px;margin:5px 0 0}.article-tg{display:flex;align-items:center;gap:10px;padding:13px 15px;border-radius:11px;background:#ecfeff;color:#0e7490;margin-top:16px}:root[data-theme="dark"] .article-tg{background:#102a33;color:#67e8f9}.article-tg i{margin-left:auto;font-style:normal}.article-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:23px}.article-tags a{background:var(--soft);padding:5px 9px;border-radius:999px;font-size:10px;color:#45648f}.article-nav{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:36px;padding-top:22px;border-top:1px solid var(--line)}.article-nav a{background:var(--card-soft);border:1px solid var(--line);border-radius:12px;padding:14px}.article-nav a.next{text-align:right}.article-nav span,.article-nav b{display:block}.article-nav span{font-size:9px;color:var(--brand)}.article-nav b{font-size:12px;margin-top:4px}.back-link{display:inline-block;margin-top:22px;color:var(--brand);font-size:11px;font-weight:800}.eyebrow{color:var(--brand);font-size:11px;font-weight:800}.simple-page{width:min(900px,calc(100% - 32px));margin:48px auto 72px}.simple-page h1{font-size:clamp(38px,6vw,58px);line-height:1.15;margin:7px 0}.lead{font-size:17px;color:var(--muted)}.prose{margin-top:27px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:clamp(23px,5vw,45px);font-size:17px;line-height:1.9}
  @media(max-width:900px){.home-banner{grid-template-columns:1fr}.quick-stats{grid-template-columns:repeat(2,1fr);margin-top:16px}.quick-stats>div:nth-child(3){border-left:0;border-top:1px solid var(--line)}.quick-stats>div:nth-child(4){border-top:1px solid var(--line)}.content-shell{grid-template-columns:1fr}.content-side{grid-template-columns:repeat(2,1fr)}.faq-list{grid-template-columns:1fr}.subscription-panel{grid-template-columns:1fr}.footer-top{grid-template-columns:1.5fr 1fr 1fr}}
  @media(max-width:680px){.promo-ribbon p{display:none}.promo-ribbon b{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.header-inner{height:64px}.brand{min-width:0}.brand-mark{width:38px;height:38px}.brand-copy small{display:none}.menu-button{display:block;margin-left:auto}.header-inner nav{display:none;position:absolute;left:12px;right:12px;top:58px;padding:9px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow)}.header-inner nav.open{display:grid}.header-inner nav a{padding:11px}.header-tools{margin-left:0}.search-button{display:none}.announcement{width:calc(100% - 20px);margin-top:10px}.announcement p{font-size:10px}.home-banner{width:calc(100% - 20px);margin-top:10px;padding:27px 20px;border-radius:16px}.banner-copy h1{font-size:38px}.banner-copy>p{font-size:14px}.hero-search{width:100%}.hero-search button{padding:8px 13px}.banner-feature{padding:20px}.banner-feature h2{font-size:22px}.quick-stats{width:calc(100% - 20px);grid-template-columns:1fr 1fr}.quick-stats>div{padding:13px}.quick-stats b{font-size:15px}.content-shell{width:calc(100% - 20px);margin-top:34px}.content-heading{align-items:flex-start;flex-direction:column}.inline-search{width:100%}.inline-search input{width:100%}.story-card{grid-template-columns:1fr}.story-cover{height:190px}.story-body h2{font-size:21px}.content-side{grid-template-columns:1fr}.footer-top{grid-template-columns:1fr}.footer-bottom{flex-direction:column}.article-layout{width:calc(100% - 20px);margin-top:12px}.article-paper{padding:22px 17px;border-radius:14px}.article-hero h1{font-size:34px}.report-numbers{grid-template-columns:1fr 1fr}.report-numbers>div{border-top:1px solid var(--line);border-left:0}.report-numbers>div:nth-child(even){border-left:1px solid var(--line)}.report-numbers>div:nth-child(-n+2){border-top:0}.article-body{font-size:16px}.subscription-panel{padding:21px 17px}.subscription-actions{grid-template-columns:1fr}.article-nav{grid-template-columns:1fr}}
  </style>`;
}
