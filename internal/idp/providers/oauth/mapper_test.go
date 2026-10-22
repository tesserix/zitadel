package oauth

import "testing"

func TestUserMapperMapsOAuthProfileWithoutTrustingEmailVerification(t *testing.T) {
	mapper := UserMapper{RawInfo: map[string]any{"id": "123", "first_name": "River", "last_name": "Fox", "name": "River Fox", "email": "river@example.invalid", "email_verified": true}, idAttribute: "id"}
	for name, pair := range map[string][2]string{"id": {mapper.GetID(), "123"}, "first": {mapper.GetFirstName(), "River"}, "last": {mapper.GetLastName(), "Fox"}, "display": {mapper.GetDisplayName(), "River Fox"}, "email": {string(mapper.GetEmail()), "river@example.invalid"}} {
		t.Run(name, func(t *testing.T) {
			if pair[0] != pair[1] {
				t.Fatalf("got %q want %q", pair[0], pair[1])
			}
		})
	}
	if mapper.IsEmailVerified() {
		t.Fatal("generic OAuth must not promote email verification")
	}
}

func TestUserMapperAcceptsStandardClaimsAndIgnoresInvalidTypes(t *testing.T) {
	mapper := UserMapper{RawInfo: map[string]any{"sub": "subject", "given_name": "Cloud", "family_name": "Wren", "email": false, "name": []string{"invalid"}, "preferred_username": "cloud-wren"}, idAttribute: "sub"}
	if mapper.GetID() != "subject" || mapper.GetFirstName() != "Cloud" || mapper.GetLastName() != "Wren" || mapper.GetPreferredUsername() != "cloud-wren" {
		t.Fatal("standard OAuth profile was not mapped")
	}
	if mapper.GetEmail() != "" || mapper.GetDisplayName() != "" {
		t.Fatal("invalid profile types must be ignored")
	}
	empty := UserMapper{}
	if empty.GetEmail() != "" || empty.GetFirstName() != "" || empty.GetLastName() != "" {
		t.Fatal("missing profile fields must remain empty")
	}
}
