export async function seedPatients(db) {
  const patients = [
    [
      '10000000-0000-4000-8000-000000000001',
      'Akash Kumar',
      '2003-05-27',
      'Male',
      'akash@example.com',
    ],
    [
      '10000000-0000-4000-8000-000000000002',
      'Alok Kumar',
      '1998-09-14',
      'Male',
      'alok@example.com',
    ],
    [
      '10000000-0000-4000-8000-000000000003',
      'Andrew Flintoff',
      '1991-02-08',
      'Male',
      'andrew@example.com',
    ],
    [
      '10000000-0000-4000-8000-000000000004',
      'Anuva Kishore',
      '2005-06-19',
      'Female',
      'anuva@example.com',
    ],
    [
      '10000000-0000-4000-8000-000000000005',
      'Anuya Kishore',
      '2004-03-12',
      'Female',
      'anuya@example.com',
    ],
    [
      '10000000-0000-4000-8000-000000000006',
      'Priya Sharma',
      '1996-11-22',
      'Female',
      'priya@example.com',
    ],
  ];
  for (const patient of patients)
    await db.query(
      `INSERT INTO patients (id, name, date_of_birth, gender, email)
    VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      patient,
    );
}
