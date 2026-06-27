/**
 * Application logic for Aptis Web TB
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on the login page (index.html) or dashboard page (student.html)
  const loginForm = document.getElementById('loginForm');
  const sidebar = document.getElementById('sidebar');

  if (loginForm) {
    initLogin();
  }

  if (sidebar) {
    initDashboard();
  }
});

/* ==========================================================================
   1. CUSTOM TOAST NOTIFICATION SYSTEM
   ========================================================================== */
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // SVG Icons for different Toast types
  let iconSvg = '';
  if (type === 'error') {
    iconSvg = `<svg class="toast-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else if (type === 'success') {
    iconSvg = `<svg class="toast-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else {
    // Warning
    iconSvg = `<svg class="toast-icon warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Đóng">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // Append and set automatic removal
  container.appendChild(toast);
  
  const autoRemoveId = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);

  // Close button functionality
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(autoRemoveId);
    toast.remove();
  });
}

/* ==========================================================================
   2. LOGIN PAGE LOGIC
   ========================================================================== */
function initLogin() {
  const loginForm = document.getElementById('loginForm');
  
  // Credentials Configuration (Hardcoded as requested)
  const VALID_CLASS_CODE = 'APTIS2026';
  const VALID_CLASS_PASSWORD = 'owlstudy';

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const classCode = document.getElementById('classCode').value.trim();
    const classPassword = document.getElementById('classPassword').value.trim();

    // 1. Validation for empty values
    if (!fullName || !phoneNumber) {
      showToast('Cảnh báo', 'Vui lòng điền đầy đủ Họ tên và Số điện thoại.', 'warning');
      return;
    }

    if (!classCode || !classPassword) {
      showToast('Cảnh báo', 'Vui lòng nhập Mã lớp và Mật khẩu lớp.', 'warning');
      return;
    }

    // 2. Class and Password Validation
    if (classCode === VALID_CLASS_CODE && classPassword === VALID_CLASS_PASSWORD) {
      // Set Auth token in localStorage
      localStorage.setItem('studentName', fullName);
      localStorage.setItem('studentPhone', phoneNumber);
      localStorage.setItem('classCode', classCode);
      localStorage.setItem('isLoggedIn', 'true');

      showToast('Đăng nhập thành công', 'Hệ thống đang chuyển hướng tới trang học viên...', 'success');

      // Redirect after toast animation delay
      setTimeout(() => {
        window.location.href = 'student.html';
      }, 1200);
    } else {
      showToast('Đăng nhập thất bại', 'Mã lớp hoặc Mật khẩu lớp không chính xác. Vui lòng thử lại!', 'error');
    }
  });
}

/* ==========================================================================
   3. STUDENT DASHBOARD LOGIC
   ========================================================================== */
function initDashboard() {
  // Retrieve user credentials
  const studentName = localStorage.getItem('studentName') || 'Học viên';
  const classCode = localStorage.getItem('classCode') || 'APTIS';

  // Display user information in Header
  document.getElementById('welcomeTitle').textContent = `Xin chào, ${studentName}`;
  document.getElementById('classBadge').textContent = `Lớp: ${classCode}`;

  // Log out action
  const btnLogout = document.getElementById('btnLogout');
  btnLogout.addEventListener('click', () => {
    // Clear storage
    localStorage.removeItem('studentName');
    localStorage.removeItem('studentPhone');
    localStorage.removeItem('classCode');
    localStorage.removeItem('isLoggedIn');

    showToast('Đăng xuất', 'Đang chuyển hướng về trang đăng nhập...', 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  });

  // Tab switching logic
  initTabNavigation();

  // Load and render components
  renderVideos();
  renderPractice();
  renderDocuments();
  renderResults();
}

/* Tab switching and mobile sidebar control */
function initTabNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.content-section');
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  // Desktop/Mobile Tab Switch
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');

      // Remove active state from menus and add to current
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Hide all sections and show active section
      sections.forEach(s => s.classList.remove('active'));
      document.getElementById(`${tabId}Section`).classList.add('active');

      // Close mobile drawer on item select
      sidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
    });
  });

  // Mobile Hamburger toggle
  menuToggle.addEventListener('click', () => {
    sidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
  });

  // Tap overlay to close
  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  });
}

/* ==========================================================================
   4. DATA RENDERING & DYNAMIC INSERTS
   ========================================================================== */

/* --- Videos Section --- */
// NOTE FOR USER: Bạn có thể thay đổi link embedUrl ở đây.
// Nếu dùng YouTube, dùng định dạng: https://www.youtube.com/embed/VIDEO_ID
// Nếu dùng Google Drive, dùng định dạng: https://drive.google.com/file/d/FILE_ID/preview
const videos = [
  {
    title: "Bài 1: Giới thiệu cấu trúc đề thi Aptis ESOL",
    description: "Tổng quan cấu trúc bài thi Aptis ESOL, cách tính điểm 4 kỹ năng và hướng dẫn học tập tối ưu.",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  },
  {
    title: "Bài 2: Phương pháp và Kỹ thuật làm bài Reading",
    description: "Chi tiết các dạng bài Reading từ Part 1 đến Part 4. Cách tìm từ khóa và loại trừ đáp án nhiễu.",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  },
  {
    title: "Bài 3: Tránh bẫy trong bài nghe Listening",
    description: "Bí quyết nhận biết các từ đồng nghĩa, cấu trúc paraphrasing và vượt qua các câu hỏi khó trong phần Nghe.",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  }
];

function renderVideos() {
  const videoGrid = document.getElementById('videoGrid');
  if (!videoGrid) return;

  videoGrid.innerHTML = videos.map((video, index) => `
    <div class="video-card">
      <div class="video-thumb">
        <svg class="thumb-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
        <div class="btn-play-overlay">
          <button class="play-circle" onclick="openVideoPlayer(${index})" aria-label="Xem bài giảng">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      </div>
      <div class="video-body">
        <h3 class="video-title">${video.title}</h3>
        <p class="video-desc">${video.description}</p>
        <button class="btn-watch" onclick="openVideoPlayer(${index})">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
          <span>Xem video</span>
        </button>
      </div>
    </div>
  `).join('');

  // Setup modal handlers
  const btnCloseModal = document.getElementById('btnCloseModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  
  if (btnCloseModal && modalBackdrop) {
    btnCloseModal.addEventListener('click', closeVideoPlayer);
    modalBackdrop.addEventListener('click', closeVideoPlayer);
  }
}

// Global functions for open/close modal to bind with inline onclick
window.openVideoPlayer = function(index) {
  const modal = document.getElementById('videoModal');
  const iframe = document.getElementById('videoIframe');
  const title = document.getElementById('videoModalTitle');
  const videoData = videos[index];

  if (!modal || !iframe || !videoData) return;

  title.textContent = videoData.title;
  iframe.src = videoData.embedUrl;
  modal.classList.add('active');
};

window.closeVideoPlayer = function() {
  const modal = document.getElementById('videoModal');
  const iframe = document.getElementById('videoIframe');

  if (!modal || !iframe) return;

  modal.classList.remove('active');
  iframe.src = ''; // Clear source to stop playing audio in background
};


/* --- Practice Section --- */
const practices = [
  {
    title: "Reading Practice",
    description: "Luyện đọc hiểu theo format mới với 4 phần đọc điền từ, ghép tiêu đề và đọc tìm thông tin.",
    count: "10 đề mẫu"
  },
  {
    title: "Listening Practice",
    description: "Rèn luyện khả năng nghe thông tin chi tiết, nghe cuộc hội thoại ngắn và hội thoại dài.",
    count: "8 đề mẫu"
  },
  {
    title: "Grammar & Vocabulary",
    description: "Kho bài tập trắc nghiệm ngữ pháp và từ vựng cốt lõi thường gặp nhất trong kỳ thi Aptis.",
    count: "15 bài luyện"
  },
  {
    title: "Full Mock Test",
    description: "Đề thi thử đầy đủ 4 kỹ năng trong phòng thi ảo, có áp lực thời gian chính xác như thi thật.",
    count: "3 đề thi thử"
  }
];

function renderPractice() {
  const practiceGrid = document.getElementById('practiceGrid');
  if (!practiceGrid) return;

  practiceGrid.innerHTML = practices.map(practice => `
    <div class="practice-card">
      <div class="practice-head">
        <div class="practice-icon-box">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </div>
        <span class="practice-badge">${practice.count}</span>
      </div>
      <div class="practice-body">
        <h3 class="practice-title">${practice.title}</h3>
        <p class="practice-desc">${practice.description}</p>
        <button class="btn-practice" onclick="handleStartPractice()">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 16.5l7-4.5-7-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
          <span>Vào luyện</span>
        </button>
      </div>
    </div>
  `).join('');
}

window.handleStartPractice = function() {
  showToast('Thông báo', 'Chức năng luyện đề sẽ được cập nhật sau.', 'warning');
};


/* --- Documents Section --- */
// NOTE FOR USER: Bạn có thể thay đổi link Google Drive mẫu ở đây.
const documents = [
  {
    title: "Tài liệu Reading Aptis",
    description: "Bộ đề ôn tập đọc hiểu kèm hướng dẫn phân tích đáp án chi tiết và từ vựng mở rộng.",
    link: "https://drive.google.com/drive/folders/1dQw4w9WgXcQ-placeholder"
  },
  {
    title: "Tài liệu Listening Aptis",
    description: "Bộ file âm thanh MP3 kèm transcript và chú thích các từ vựng cần lưu ý khi thi nghe.",
    link: "https://drive.google.com/drive/folders/1dQw4w9WgXcQ-placeholder"
  },
  {
    title: "Từ vựng Aptis chủ chốt",
    description: "Hệ thống từ vựng phân loại theo chủ đề thường gặp nhất giúp nâng điểm Writing và Speaking.",
    link: "https://drive.google.com/drive/folders/1dQw4w9WgXcQ-placeholder"
  },
  {
    title: "Grammar cơ bản & nâng cao",
    description: "Tổng hợp toàn bộ kiến thức ngữ pháp bắt buộc phải có cho thí sinh chinh phục chứng chỉ Aptis.",
    link: "https://drive.google.com/drive/folders/1dQw4w9WgXcQ-placeholder"
  }
];

function renderDocuments() {
  const documentGrid = document.getElementById('documentGrid');
  if (!documentGrid) return;

  documentGrid.innerHTML = documents.map(doc => `
    <div class="doc-card">
      <div class="doc-icon-box">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      </div>
      <div class="doc-info">
        <h3 class="doc-title">${doc.title}</h3>
        <p class="doc-desc">${doc.description}</p>
        <button class="btn-doc" onclick="openDocument('${doc.link}')">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          <span>Mở tài liệu</span>
        </button>
      </div>
    </div>
  `).join('');
}

window.openDocument = function(url) {
  window.open(url, '_blank');
};


/* --- Results Section --- */
function renderResults() {
  const resultsContent = document.getElementById('resultsContent');
  if (!resultsContent) return;

  // Since initially student has no records (Empty state is required)
  resultsContent.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h3>Chưa có dữ liệu học tập</h3>
      <p>Bạn chưa hoàn thành bài luyện nào.</p>
    </div>
  `;
}
