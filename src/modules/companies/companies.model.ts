export const companiesModel = {
  insert: () => `
    INSERT INTO companies (name, segment, description, website, city, state, employees_band, area, logo_path)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,

  linkToProfile: () => `UPDATE profiles SET company_id = $2 WHERE user_id = $1`,

  byId: () => `SELECT * FROM companies WHERE id = $1 LIMIT 1`,

  // dono = usuário cujo profile.company_id aponta para esta empresa
  isOwner: () => `SELECT 1 FROM profiles WHERE user_id = $1 AND company_id = $2 LIMIT 1`,

  update: () => `
    UPDATE companies SET
      name = COALESCE($2,name), segment = COALESCE($3,segment), description = COALESCE($4,description),
      website = COALESCE($5,website), city = COALESCE($6,city), state = COALESCE($7,state),
      employees_band = COALESCE($8,employees_band), area = COALESCE($9,area), logo_path = COALESCE($10,logo_path)
    WHERE id = $1 RETURNING *`,
};
