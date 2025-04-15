import os
import jwt
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

def main():
    # Load environment variables
    load_dotenv()

    print("\n===== TOKEN DIAGNOSTIC TOOL =====\n")

    token = input("Paste your token from localStorage here: ")

    if not token or token.strip() == "":
        print("No token provided. Exiting.")
        return

    print("\nAnalyzing token...")

    # Check for demo token
    if token == 'demo-token-for-testing':
        print("\n⚠️ CRITICAL: You are using the literal demo token!")
        print("This is causing all your authentication issues.")
        print("\nSOLUTION:")
        print("1. Clear localStorage in your browser")
        print("2. Log in with a real account")
        print("3. Try connecting to YouTube again")
        return

    # Try to decode the token
    try:
        # Get the secret key from the .env file or use a default
        secret_key = os.getenv('SECRET_KEY', 'your-secret-key')
        print(f"Using secret key: {'****' + secret_key[-4:] if secret_key else 'Not found'}")

        decoded = jwt.decode(token, secret_key, algorithms=['HS256'])

        print("\nToken successfully decoded:")
        print(f"  Email: {decoded.get('email', 'Not found')}")
        print(f"  Expiration: {decoded.get('exp', 'Not found')}")

        # Check if email contains 'demo'
        if 'demo' in str(decoded.get('email', '')).lower():
            print("\n⚠️ CRITICAL: Your email contains 'demo'!")
            print("This is causing the server to treat you as a demo user.")
            print("\nSOLUTION:")
            print("1. Clear localStorage in your browser")
            print("2. Log in with a different email that doesn't contain 'demo'")
            print("3. Try connecting to YouTube again")
            return

        # Check if the user exists in the database
        try:
            mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
            print(f"Connecting to database: {mongo_uri.split('@')[-1] if '@' in mongo_uri else mongo_uri}")

            client = MongoClient(mongo_uri)

            # Try both database names
            databases = ['yt_shorts_app', 'youtube_shorts_db']
            user = None

            for db_name in databases:
                print(f"Checking database: {db_name}")
                db = client[db_name]
                user = db.users.find_one({'email': decoded.get('email')})
                if user:
                    print(f"User found in database: {db_name}")
                    break

            if user:
                print(f"\nUser found in database with ID: {user.get('_id')}")
                print(f"Name: {user.get('name', 'Not found')}")
            else:
                print("\n⚠️ User not found in database!")
                print(f"No user with email '{decoded.get('email')}' exists in the databases.")
                print("\nSOLUTION:")
                print("1. Register a new account")
                print("2. Try connecting to YouTube again")

                # List all available databases
                print("\nAvailable databases:")
                for db_name in client.list_database_names():
                    print(f" - {db_name}")

        except Exception as e:
            print(f"\nError connecting to database: {e}")

    except jwt.ExpiredSignatureError:
        print("\n⚠️ Token has expired!")
        print("You need to log in again.")
    except jwt.InvalidTokenError:
        print("\n⚠️ Invalid token format!")
        print("The token structure is not valid. You need to log in again.")
    except Exception as e:
        print(f"\n⚠️ Error decoding token: {e}")

    print("\n===== ANALYSIS COMPLETE =====")

if __name__ == "__main__":
    main()
