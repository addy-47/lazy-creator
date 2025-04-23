export const scrollToStep = (element: HTMLElement | null) => {
  if (!element) return;

  const offset = 100; // Account for sticky header
  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - offset;

  window.scrollTo({
    top: offsetPosition,
    behavior: "smooth",
  });
};
