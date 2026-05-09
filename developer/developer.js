
document.addEventListener('DOMContentLoaded', init);
async function init() {
  const backBtn = document.getElementById('back-btn');
  backBtn.addEventListener('click', () => {
    window.location.href = '../dashboard/dashboard.html';
  });
  const version = '0.0.0.1';
  console.log(`ShiftController v${version} - Developer Profile Loaded`);
}
