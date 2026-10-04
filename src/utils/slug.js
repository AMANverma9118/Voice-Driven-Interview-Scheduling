const Company = require('../models/Company');

function slugBase(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'company';
}

async function uniqueSlug(name, ignoreId) {
  const base = slugBase(name);
  let slug = base;
  let n = 2;
  const query = { slug };
  if (ignoreId) query._id = { $ne: ignoreId };
  while (await Company.findOne(query)) {
    slug = `${base}-${n}`;
    query.slug = slug;
    n += 1;
  }
  return slug;
}

module.exports = { slugBase, uniqueSlug };
