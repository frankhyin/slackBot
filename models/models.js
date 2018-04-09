var mongoose = require('mongoose');
var connect = process.env.MONGODB_URI;
var Schema = mongoose.Schema;

mongoose.connect(connect);

var userSchema = Schema({
    slackID: {
        type: String,
        required: true
    },
    tokens: {
        type: Object,
        required: true
    },
});

var User = mongoose.model('User', userSchema);

User.findOrCreate = function (searchObj, createObj, callback){
    User.findOne(searchObj, function(err, user){
        console.log(err, user);
        if (!user){
            var new_user = new User(createObj);
            new_user.save(callback);
        }
        else {
            callback(null, user);
        }
    });
}

module.exports = {
    User: User
  };
  