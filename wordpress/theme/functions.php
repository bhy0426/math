<?php
/**
 * MathSite 헤드리스 테마.
 *
 * 화면은 React(math/client)가 그리고, WordPress는 관리자에서 편집한 페이지 내용을
 * REST API(/wp-json/wp/v2/pages)로 제공만 한다. 화면 주소와 같은 슬러그의 페이지 내용이
 * 해당 React 화면에 표시된다. 설명: math/docs/wordpress.md
 */

if (!defined('ABSPATH')) {
    exit;
}

// 슬러그 → [React 화면 주소, 기본 제목, 기본 내용(블록), 처음부터 공개 여부]
const MATHSITE_PAGES = [
    'home' => [
        '/',
        'MathSite',
        '<!-- wp:paragraph --><p>관리자가 허용한 수학 강의를 온라인으로 학습할 수 있습니다.</p><!-- /wp:paragraph -->' .
        "\n\n" .
        '<!-- wp:paragraph --><p><a href="/info">학원 소개</a> · <a href="/courses">강좌 보기</a> · <a href="/boards">공지사항</a></p><!-- /wp:paragraph -->',
        true,
    ],
    'info' => [
        '/info',
        '학원 소개 · Q&A',
        '<!-- wp:paragraph --><p>MathSite는 강좌와 강의 영상을 제공하는 수학 학원 사이트입니다.</p><!-- /wp:paragraph -->',
        true,
    ],
    'courses' => ['/courses', '강좌 목록', '', false],
    'boards' => ['/boards', '공지사항', '', false],
    'login' => ['/login', '로그인', '', false],
    'register' => ['/register', '회원가입', '', false],
];

const MATHSITE_SEED_VERSION = '1';

/**
 * 처음 한 번 React 화면에 대응하는 페이지를 만든다. 이미 있는 페이지는 건드리지 않는다.
 * 메인·학원 소개는 기존 React 문구로 공개하고, 나머지는 빈 초안으로 만든다.
 * 초안이나 비공개 페이지는 화면에 나타나지 않는다.
 */
add_action('init', function () {
    if (get_option('mathsite_seed_version') === MATHSITE_SEED_VERSION) {
        return;
    }
    foreach (MATHSITE_PAGES as $slug => [$path, $title, $content, $publish]) {
        if (get_page_by_path($slug, OBJECT, 'page')) {
            continue;
        }
        wp_insert_post([
            'post_type' => 'page',
            'post_name' => $slug,
            'post_title' => $title,
            'post_content' => $content,
            'post_status' => $publish ? 'publish' : 'draft',
        ]);
    }
    $home = get_page_by_path('home', OBJECT, 'page');
    if ($home) {
        update_option('show_on_front', 'page');
        update_option('page_on_front', $home->ID);
    }
    update_option('mathsite_seed_version', MATHSITE_SEED_VERSION);
});

// WordPress 자체 화면은 쓰지 않는다. (nginx가 화면 요청을 React로 보내므로 보통 여기 오지 않는다.)
add_action('template_redirect', function () {
    if (is_preview()) {
        return;
    }
    wp_safe_redirect(home_url('/'), 302);
    exit;
});

// 관리자 "페이지 보기" 링크를 React 화면 주소로 맞춘다.
add_filter('page_link', function ($link, $post_id) {
    $post = get_post($post_id);
    if ($post && isset(MATHSITE_PAGES[$post->post_name])) {
        return home_url(MATHSITE_PAGES[$post->post_name][0]);
    }
    return $link;
}, 10, 2);

// 페이지 목록 위에 어떤 페이지가 어느 화면에 나오는지 안내한다.
add_action('admin_notices', function () {
    $screen = get_current_screen();
    if (!$screen || $screen->id !== 'edit-page') {
        return;
    }
    $rows = '';
    foreach (MATHSITE_PAGES as $slug => [$path]) {
        $rows .= sprintf('<li><code>%s</code> → <a href="%s" target="_blank">%s</a></li>', esc_html($slug), esc_url(home_url($path)), esc_html($path));
    }
    printf(
        '<div class="notice notice-info"><p><strong>MathSite 화면 연결</strong> — 아래 슬러그(고유주소)의 <em>공개</em> 페이지 내용이 같은 주소의 사이트 화면 위쪽에 표시됩니다. 슬러그를 바꾸면 화면에 나오지 않습니다. 초안·비공개로 두면 숨겨집니다.</p><ul style="margin-left:1em">%s</ul></div>',
        $rows
    );
});

/**
 * React 화면 위쪽 관리자 바용 정보. WordPress에 로그인한 편집자에게만 링크를 돌려준다.
 * REST API는 nonce 없이 쿠키 로그인을 인정하지 않으므로 admin-ajax를 쓴다.
 * GET /wp-admin/admin-ajax.php?action=mathsite_admin_bar&slug=info
 */
function mathsite_admin_bar_info()
{
    nocache_headers();
    if (!current_user_can('edit_pages')) {
        wp_send_json(['loggedIn' => false]);
    }
    $slug = sanitize_title(wp_unslash($_GET['slug'] ?? ''));
    $page = $slug ? get_page_by_path($slug, OBJECT, 'page') : null;
    $user = wp_get_current_user();
    wp_send_json([
        'loggedIn' => true,
        'name' => $user->display_name,
        'dashboardUrl' => admin_url(),
        'pagesUrl' => admin_url('edit.php?post_type=page'),
        'editUrl' => $page && current_user_can('edit_post', $page->ID)
            ? get_edit_post_link($page->ID, 'raw')
            : null,
        'pageStatus' => $page ? $page->post_status : null,
        'newPageUrl' => admin_url('post-new.php?post_type=page'),
        'logoutUrl' => wp_logout_url(home_url('/')),
    ]);
}
add_action('wp_ajax_mathsite_admin_bar', 'mathsite_admin_bar_info');
add_action('wp_ajax_nopriv_mathsite_admin_bar', 'mathsite_admin_bar_info');

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('editor-styles');
    add_theme_support('wp-block-styles');
});
