import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('/Users/abhinavkumardwivedi/Desktop/GlomoPay/.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL, 
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function purge() {
    console.log("Locating and purging demo mock items from remote Supabase...");
    const { data, error } = await supabase
        .from('documents')
        .delete()
        .like('source_url', '%demo%')
        .select();
        
    if (error) {
        console.error("Purge Error:", error);
    } else {
        console.log(`Success! Purged ${data.length} obsolete items.`);
    }
}
purge();
