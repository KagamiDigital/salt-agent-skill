const { Salt } = require('salt-sdk');
const { loadConfig, getSigner } = require('../utils/config');

async function invitesCommand(action, options) {
  try {
    const environment = options.testnet ? 'TESTNET' : 'MAINNET';
    
    console.log('🧂 Salt Invitations\n');
    console.log(`Environment: ${environment}`);
    console.log('');
    
    // Load config and authenticate
    const config = loadConfig();
    const signer = getSigner(environment, config);
    
    const salt = new Salt({ environment });
    await salt.authenticate(signer);
    console.log('✅ Authenticated\n');
    
    // Get invitations
    const { invitations } = await salt.getOrganisationsInvitations();
    
    if (action === 'list' || !action) {
      // List invitations
      console.log('📬 Pending Invitations:\n');
      
      if (invitations.length === 0) {
        console.log('   No pending invitations');
      } else {
        invitations.forEach((inv, index) => {
          console.log(`   ${index + 1}. ${inv.organisationName || 'Unnamed Organization'}`);
          console.log(`      Org ID: ${inv.organisationId}`);
          console.log(`      Invitation ID: ${inv._id}`);
          console.log('');
        });
      }
      
    } else if (action === 'accept') {
      // Accept specific invitation
      const inviteId = options.id;
      if (!inviteId) {
        console.error('❌ Error: Must specify invitation ID with --id');
        process.exit(1);
      }
      
      const invitation = invitations.find(inv => inv._id === inviteId);
      if (!invitation) {
        console.error(`❌ Error: Invitation ${inviteId} not found`);
        process.exit(1);
      }
      
      console.log(`📬 Accepting invitation to: ${invitation.organisationName || 'Unnamed Org'}`);
      await salt.acceptOrganisationInvitation(inviteId);
      console.log('✅ Invitation accepted!');
      
    } else if (action === 'accept-all') {
      // Accept all invitations
      if (invitations.length === 0) {
        console.log('📬 No invitations to accept');
      } else {
        console.log(`📬 Accepting ${invitations.length} invitation(s)...\n`);
        
        for (const invitation of invitations) {
          console.log(`   Accepting: ${invitation.organisationName || 'Unnamed Org'}`);
          await salt.acceptOrganisationInvitation(invitation._id);
        }
        
        console.log(`\n✅ Accepted ${invitations.length} invitation(s)!`);
      }
      
    } else {
      console.error(`❌ Unknown action: ${action}`);
      console.error('Valid actions: list, accept, accept-all');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (process.env.DEBUG) console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { invitesCommand };
