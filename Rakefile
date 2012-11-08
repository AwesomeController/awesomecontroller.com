require "right_aws"
require "digest/md5"
require "mime/types"

public_dir      = "public"    # compiled site directory
server_port     = "4000"      # port for preview server eg. localhost:4000

desc "preview the site in a web browser"
task :preview do
  puts "Starting Rack on port #{server_port}"
  rackupPid = spawn("rackup --port #{server_port}")

  trap("INT") {
	Process.kill(9, rackupPid)
	exit 0
  }

  Process.wait
end

##############
# Deploying  #
##############


def aws_init
  return {
    :access_key_id      => ENV['ac_aws_access_key_id'],
    :secret_access_key  => ENV['ac_aws_secret_access_key'],
    :s3_bucket => ENV['ac_s3_bucket'],
  }
end


def s3_deploy(aws_access_key_id, aws_secret_access_key, s3_bucket, public_dir)
  logger = Logger.new(STDOUT)
  logger.level = Logger::WARN
  s3 = RightAws::S3.new(aws_access_key_id, aws_secret_access_key, { :logger => logger })
  paths_to_invalidate = []
  # Retreive bucket or create it if not available
  puts "Getting bucket"
  bucket = s3.bucket(s3_bucket, true, 'public-read')
  Dir.glob("#{public_dir}/**/*").each do |file|
    if File.file?(file)
      remote_file = file.gsub("#{public_dir}/", "")
      key = bucket.key(remote_file, true)
      if !key || (key.e_tag != ("\"" + Digest::MD5.hexdigest(File.read(file))) + "\"")
        puts "Deploying file #{remote_file}"
        bucket.put(key, open(file), {}, 'public-read', {
          'content-type'        => MIME::Types.type_for(file).first.to_s,
          'x-amz-storage-class' => 'REDUCED_REDUNDANCY'
        })
        paths_to_invalidate << "/#{remote_file}"
      end
    end
  end
  return paths_to_invalidate
end

def cloudfront_init(aws_access_key_id, aws_secret_access_key, s3_bucket)
  puts "Checking Amazon CloudFront environment"
  logger = Logger.new(STDOUT)
  logger.level = Logger::WARN
  acf = RightAws::AcfInterface.new(aws_access_key_id, aws_secret_access_key, { :logger => logger })
  distributions = acf.list_distributions
  # Locate distribution by CNAME
  distributions = distributions.select { |distribution| distribution[:cnames].include?(s3_bucket) }
  # Create distribution if not found
  if (distributions.empty?) then
    puts "Creating Amazon CloudFront distribution... This usually requires a few minutes, please be patient!"
    config = {
      :enabled              => true,
      :comment              => "http://#{s3_bucket}",
      :cnames               => [ s3_bucket ],
      :s3_origin            => {
        :dns_name           => "#{s3_bucket}.s3.amazonaws.com"
      },
      :default_root_object  => 'index.html'
    }
    distributionID = acf.create_distribution(config)[:aws_id]
    # Wait for distribution to be created... This can take a while!
    while (acf.get_distribution(distributionID)[:status] == 'InProgress')
      puts "Still waiting for CloudFront distribution to be started..."
      sleep 30
    end
    distribution = distributions.select { |distribution| distribution[:cnames].include?(s3_bucket) }.first
    puts "Distribution #{distributionID} created and ready to serve your blog"
  else
    distribution = distributions.first
    puts "Distribution #{distribution[:aws_id]} found"
  end
  return distribution
end

def cloudfront_invalidate(aws_access_key_id, aws_secret_access_key, distribution, paths_to_invalidate)
  if (paths_to_invalidate.empty?) then
    return;
  end
  puts "Invalidating CloudFront caches"
  logger = Logger.new(STDOUT)
  logger.level = Logger::WARN
  acf = RightAws::AcfInterface.new(aws_access_key_id, aws_secret_access_key, { :logger => logger })
  acf.create_invalidation distribution[:aws_id], :path => paths_to_invalidate
end

desc "Deploy website to Amazon S3"
task :s3 do
  puts "## Deploying website to Amazon S3"
  aws = aws_init
  s3_deploy(
    aws[:access_key_id],
    aws[:secret_access_key],
    aws[:s3_bucket],
    public_dir)
  puts "\n## Amazon S3 deploy complete"
end

desc "Deploy website to Amazon CloudFront"
task :cloudfront do
  puts "## Deploying website to Amazon CloudFront"
  aws = aws_init
  distribution = cloudfront_init(aws[:access_key_id], aws[:secret_access_key], aws[:s3_bucket])
  paths_to_invalidate = s3_deploy(aws[:access_key_id], aws[:secret_access_key], aws[:s3_bucket], public_dir)
  cloudfront_invalidate(aws[:access_key_id], aws[:secret_access_key], distribution, paths_to_invalidate)
  puts "\n## Amazon CloudFront deploy complete"
end

def ok_failed(condition)
  if (condition)
    puts "OK"
  else
    puts "FAILED"
  end
end

desc "list tasks"
task :list do
  puts "Tasks: #{(Rake::Task.tasks - [Rake::Task[:list]]).join(', ')}"
  puts "(type rake -T for more detail)\n\n"
end
