 const roles = {
        logging: [],
        mining: [],
        harvesting: [],
        skinning: [],
        blacksmith: [],
        engineering: [],
        outfitting: [],
        cooking: [],
        alchemy: [],
        survival: [],
        repair: [],
        rebels: []
    };
    
let jobs = 'mining, cook, repair';

for (let role in roles) {
  if (jobs.includes(role.substring(0, 3))) {
    role.push(member.user.username);
   }
}
