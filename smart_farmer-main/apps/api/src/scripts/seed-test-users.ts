import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { User, UserSchema } from '../auth/schemas/user.schema';
import { env } from '../common/utils/env';

type SeedUser = {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'farmer' | 'customer';
  full_name: string;
  city: string;
  state: string;
  district: string;
  is_verified: boolean;
  is_staff: boolean;
  is_superuser: boolean;
};

const testUsers: SeedUser[] = [
  {
    username: 'testadmin',
    email: 'admin@test.local',
    password: 'AdminPass#2026',
    role: 'admin',
    full_name: 'Test Admin',
    city: 'Hyderabad',
    state: 'Telangana',
    district: 'Hyderabad',
    is_verified: true,
    is_staff: true,
    is_superuser: true,
  },
  {
    username: 'testfarmer',
    email: 'farmer@test.local',
    password: 'FarmerPass#2026',
    role: 'farmer',
    full_name: 'Test Farmer',
    city: 'Guntur',
    state: 'Andhra Pradesh',
    district: 'Guntur',
    is_verified: true,
    is_staff: false,
    is_superuser: false,
  },
  {
    username: 'testcustomer',
    email: 'customer@test.local',
    password: 'CustomerPass#2026',
    role: 'customer',
    full_name: 'Test Customer',
    city: 'Hyderabad',
    state: 'Telangana',
    district: 'Medchal',
    is_verified: true,
    is_staff: false,
    is_superuser: false,
  },
];

async function main() {
  await mongoose.connect(env.mongodbUri, {
    dbName: env.mongodbName,
  });

  const UserModel =
    (mongoose.models[User.name] as mongoose.Model<User>) ||
    mongoose.model(User.name, UserSchema);

  for (const user of testUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await UserModel.findOneAndUpdate(
      { email: user.email.toLowerCase() },
      {
        $set: {
          username: user.username,
          email: user.email.toLowerCase(),
          password_hash: passwordHash,
          role: user.role,
          full_name: user.full_name,
          city: user.city,
          state: user.state,
          district: user.district,
          is_verified: user.is_verified,
          is_staff: user.is_staff,
          is_superuser: user.is_superuser,
          preferred_language: 'en',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  console.log(`Seeded ${testUsers.length} test users into ${env.mongodbName}.`);
  for (const user of testUsers) {
    console.log(`${user.role}: ${user.email} / ${user.password}`);
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed test users.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
