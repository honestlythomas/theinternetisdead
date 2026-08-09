/* BANANARAMA LEVEL 2 CLICK PATCH */
document.addEventListener('click', (event) => {
  const bananaLevel2Link = event.target.closest('.bananarama-level2-link');
  if (!bananaLevel2Link) return;
  event.preventDefault();

  const continueButton =
    document.querySelector('#continueToLevel2Button') ||
    document.querySelector('.continue-to-level-2') ||
    Array.from(document.querySelectorAll('button')).find((button) =>
      /continue to level 2/i.test(button.textContent || '')
    );

  if (continueButton) {
    continueButton.click();
    return;
  }

  if (requestContinueToLevel2()) return;

  window.location.href = 'shooter-game-level2.html';
});

/* YOU WIN VISIBILITY ACTIVATION FALLBACK */
document.addEventListener('click', () => {
  const overlay = document.getElementById('levelCompleteOverlay') || document.getElementById('winOverlay');
  if (!overlay) return;
  if (/You Win|Completion Stats/i.test(overlay.textContent || '') && overlay.style.display && overlay.style.display !== 'none') {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.remove('hidden');
  }
});
