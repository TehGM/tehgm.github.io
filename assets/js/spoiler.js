$(':not(.admonition).spoiler').on('click', function () {
    $(this).removeClass('hidden');
});